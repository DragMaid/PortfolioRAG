using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using Amazon;
using Amazon.Runtime;
using Amazon.S3;
using Backend.Common;
using Backend.Common.OpenApi;
using Backend.Common.Options;
using Backend.Common.Security;
using Backend.Data;
using Backend.Repositories;
using Backend.Services;
using FileSignatures;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using NSwag;

var builder = WebApplication.CreateBuilder(args);

var noCheck = args.Contains("--noCheck");

if (noCheck && !builder.Environment.IsDevelopment())
{
    throw new InvalidOperationException(
        "--noCheck skips the startup configuration checks and is only accepted in the Development " +
        $"environment; this process is running as '{builder.Environment.EnvironmentName}'. Drop the " +
        "flag and supply the missing configuration.");
}

// Add services to the container.

// Change the enum interger over json transfer to string
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

// NOTE: failing here rather than at the first query — a missing connection string is a
// deployment mistake, and an API that boots and then 500s on every request hides it.
var connectionString = builder.Configuration.GetConnectionString("Postgres");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "The 'Postgres' connection string is not configured. Development reads it from " +
        "appsettings.Development.json (docker compose up -d db); elsewhere supply it through " +
        "user secrets or the ConnectionStrings__Postgres environment variable.");
}

builder.Services.AddDbContext<BlogDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddSingleton(TimeProvider.System);

builder.Services.AddScoped<IAuthorRepository, AuthorRepository>();
builder.Services.AddScoped<IPostRepository, PostRepository>();
builder.Services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
builder.Services.AddScoped<IApiTokenRepository, ApiTokenRepository>();
builder.Services.AddScoped<IMediaRepository, MediaRepository>();
builder.Services.AddScoped<IAnalyticsRepository, AnalyticsRepository>();

builder.Services.AddScoped<IAuthorService, AuthorService>();
builder.Services.AddScoped<IPostService, PostService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IMediaService, MediaService>();
builder.Services.AddScoped<IAnalyticsService, AnalyticsService>();

// NOTE: the visitor salt is too insignificant so ill leave it as optional for now
var analyticsOptions = builder.Configuration
    .GetSection(AnalyticsOptions.SectionName)
    .Get<AnalyticsOptions>() ?? new AnalyticsOptions();

builder.Services.Configure<AnalyticsOptions>(builder.Configuration.GetSection(AnalyticsOptions.SectionName));

// ---------------------------------------------------------------------------
// Media storage
// ---------------------------------------------------------------------------

// Which bucket the media endpoints talk to. Backblaze in a real deployment, an S3
// endpoint — a MinIO container — for local work; the credentials for the one that is not
// selected are never looked at, so only one of the two sections has to be filled in.
var storageOptions = builder.Configuration
    .GetSection(StorageOptions.SectionName)
    .Get<StorageOptions>() ?? new StorageOptions();

builder.Services.Configure<StorageOptions>(builder.Configuration.GetSection(StorageOptions.SectionName));

var backblazeOptions = builder.Configuration
    .GetSection(BackblazeOptions.SectionName)
    .Get<BackblazeOptions>() ?? new BackblazeOptions();

var s3Options = builder.Configuration
    .GetSection(S3Options.SectionName)
    .Get<S3Options>() ?? new S3Options();

// NOTE: if the selected provider is not configured then fail the program, as before —
// only the selected one, because a deployment running on MinIO has no B2 key to give.
if (!noCheck)
{
    if (storageOptions.Provider == StorageProvider.S3)
        s3Options.Validate();
    else
        backblazeOptions.Validate();
}

var mediaOptions = builder.Configuration
    .GetSection(MediaOptions.SectionName)
    .Get<MediaOptions>() ?? new MediaOptions();
if (!noCheck)
    mediaOptions.Validate();

builder.Services.Configure<BackblazeOptions>(builder.Configuration.GetSection(BackblazeOptions.SectionName));
builder.Services.Configure<S3Options>(builder.Configuration.GetSection(S3Options.SectionName));
builder.Services.Configure<MediaOptions>(builder.Configuration.GetSection(MediaOptions.SectionName));

// The Backblaze client caches authorization and upload URLs here; the download tokens
// BackblazeStorage hands out share the same cache. S3Storage signs its links locally and
// needs none of it.
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<IImageOptimizer, ImageOptimizer>();

// FileSignatures assembly to collect the format list, and it holds no per-call state.
builder.Services.AddSingleton<IFileFormatInspector>(_ => new FileFormatInspector());
builder.Services.AddSingleton<IMediaTypeDetector, FileSignatureMediaTypeDetector>();

// NOTE: choosing what provider to build for the run
switch (storageOptions.Provider)
{
    // Configure S3 MinIO storage
    case StorageProvider.S3 when s3Options.IsConfigured:
        builder.Services.AddSingleton<IAmazonS3>(_ =>
        {
            var config = new AmazonS3Config
            {
                // MinIO is reached by path unless it has wildcard DNS, and localhost never
                // has: without this the SDK would send bucket.localhost and resolve nothing.
                ForcePathStyle = s3Options.ForcePathStyle,
                AuthenticationRegion = s3Options.Region
            };

            if (!string.IsNullOrWhiteSpace(s3Options.ServiceUrl))
            {
                config.ServiceURL = s3Options.ServiceUrl;
                config.UseHttp = s3Options.ServiceUrl
                    .StartsWith("http://", StringComparison.OrdinalIgnoreCase);
            }
            else
            {
                config.RegionEndpoint = RegionEndpoint.GetBySystemName(s3Options.Region);
            }

            return new AmazonS3Client(
                new BasicAWSCredentials(s3Options.AccessKeyId, s3Options.SecretAccessKey),
                config);
        });

        builder.Services.AddSingleton<IObjectStorage, S3Storage>();
        break;

    // Configure Backblaze storage
    case StorageProvider.Backblaze when backblazeOptions.IsConfigured:
        builder.Services.AddBackblazeAgent(options =>
        {
            options.KeyId = backblazeOptions.KeyId;
            options.ApplicationKey = backblazeOptions.ApplicationKey;
        });

        builder.Services.AddSingleton<IObjectStorage, BackblazeStorage>();
        break;

    // Fuck all the above, just run it
    default:
        builder.Services.AddSingleton<IObjectStorage, UnconfiguredStorage>();
        break;
}

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = mediaOptions.MaxUploadBytes + RequestOverheadBytes;
});

// NOTE: this one add problem+json instead of 500s for debuggability
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<DefaultExceptionHandler>();

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

// NOTE: failing here beats booting with an unusable signing key and only finding out on
// the first login. Development supplies a throwaway key in appsettings.Development.json;
// anything else has to provide its own (user secrets, or the Jwt__Key environment variable).
var jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
if (!noCheck)
    jwtOptions.Validate();

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));

if (noCheck && (string.IsNullOrWhiteSpace(jwtOptions.Key) || jwtOptions.Key.Length < JwtOptions.MinimumKeyLength))
{
    jwtOptions.Key = Convert.ToBase64String(RandomNumberGenerator.GetBytes(JwtOptions.MinimumKeyLength));

    var ephemeralKey = jwtOptions.Key;
    builder.Services.PostConfigure<JwtOptions>(options => options.Key = ephemeralKey);
}

builder.Services.Configure<GoogleAuthOptions>(builder.Configuration.GetSection(GoogleAuthOptions.SectionName));

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();

// Google publishes the keys its ID tokens are signed with; the manager caches and rotates
// them, so it is a singleton shared by every sign-in.
builder.Services.AddSingleton<IConfigurationManager<OpenIdConnectConfiguration>>(serviceProvider =>
{
    var googleOptions = builder.Configuration
        .GetSection(GoogleAuthOptions.SectionName)
        .Get<GoogleAuthOptions>() ?? new GoogleAuthOptions();

    return new ConfigurationManager<OpenIdConnectConfiguration>(
        googleOptions.MetadataAddress,
        new OpenIdConnectConfigurationRetriever(),
        new HttpDocumentRetriever { RequireHttps = true });
});

builder.Services.AddSingleton<IGoogleTokenValidator, GoogleTokenValidator>();

// Two kinds of credential arrive in the same Authorization header: a studio session's JWT,
// and an API token an author issued for a script. The policy scheme below looks at the
// header and forwards to whichever handler can read it, so [Authorize] keeps its plain
// meaning — "any credential this API accepts" — and no controller has to name a scheme.
builder.Services
    .AddAuthentication(AuthSchemes.Default)
    .AddPolicyScheme(AuthSchemes.Default, AuthSchemes.Default, options =>
    {
        options.ForwardDefaultSelector = context =>
        {
            var header = context.Request.Headers.Authorization.ToString();
            var separator = header.IndexOf(' ');

            if (separator < 0)
                return AuthSchemes.Session;

            var scheme = header[..separator];
            var value = header[(separator + 1)..].Trim();

            // NOTE: the pfl_ marker is what makes "Bearer <something>" unambiguous. Without
            // it an API token would have to travel under its own header name, and every
            // client that only knows how to send a bearer token could not use one.
            return scheme.Equals(AuthSchemes.ApiToken, StringComparison.OrdinalIgnoreCase) ||
                   ApiTokenGenerator.LooksLikeApiToken(value)
                ? AuthSchemes.ApiToken
                : AuthSchemes.Session;
        };
    })
    .AddScheme<AuthenticationSchemeOptions, ApiTokenAuthenticationHandler>(AuthSchemes.ApiToken, null)
    .AddJwtBearer(AuthSchemes.Session, options =>
    {
        // NOTE: without this the handler renames "sub" to the long WS-Federation claim URI,
        // which is why CurrentUser can read JwtRegisteredClaimNames.Sub directly.
        options.MapInboundClaims = false;

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key)),
            NameClaimType = JwtRegisteredClaimNames.Name,
            // An access token lives ~15 minutes; letting an expired one linger for another five would defeat the point.
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

// NOTE: cors system for the react frontend
var allowedOrigins =
    builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (allowedOrigins.Length > 0)
        {
            policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();
        }
    });
});

builder.Services.AddOpenApiDocument(settings =>
{
    settings.Title = "Blog API";
    settings.Version = "v1";
    settings.Description = "Portfolio blog website";

    // Lets Swagger UI's Authorize button paste an access token.
    settings.AddSecurity("Bearer", new OpenApiSecurityScheme
    {
        Type = OpenApiSecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description =
            "The accessToken returned by POST /api/auth/login, or an API token from " +
            "POST /api/auth/tokens (they share this header). A read-scoped token may only " +
            "use GET; no token may manage tokens, credentials or the account."
    });

    settings.OperationProcessors.Add(new BearerSecurityProcessor("Bearer"));
});

var app = builder.Build();
app.UseExceptionHandler();

if (!app.Environment.IsDevelopment() &&
    string.Equals(analyticsOptions.VisitorSalt, new AnalyticsOptions().VisitorSalt, StringComparison.Ordinal))
{
    app.Logger.LogWarning(
        "Analytics is using the built-in development visitor salt. Set '{SectionName}:VisitorSalt' " +
        "(or Analytics__VisitorSalt) to a value of this deployment's own.",
        AnalyticsOptions.SectionName);
}

// NOTE: Said once at boot rather than from the stand-in service, which is not constructed until the first media request
var storageConfigured = storageOptions.Provider == StorageProvider.S3
    ? s3Options.IsConfigured
    : backblazeOptions.IsConfigured;

if (!storageConfigured)
{
    app.Logger.LogWarning(
        "Storage provider {Provider} is not configured: media storage is disabled and every media " +
        "request will answer 503. Fill in the '{SectionName}' section to enable it.",
        storageOptions.Provider,
        storageOptions.Provider == StorageProvider.S3 ? S3Options.SectionName : BackblazeOptions.SectionName);
}
else
{
    app.Logger.LogInformation("Media storage provider: {Provider}.", storageOptions.Provider);
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseOpenApi();
    app.UseSwaggerUi();

    // NOTE: development brings its own database up to date and seeds it, so a fresh clone
    using var scope = app.Services.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<BlogDbContext>();
    var timeProvider = scope.ServiceProvider.GetRequiredService<TimeProvider>();
    var storage = scope.ServiceProvider.GetRequiredService<IObjectStorage>();

    await context.Database.MigrateAsync();
    await BlogDbSeeder.SeedAsync(context, timeProvider, storage, app.Logger);
}

app.UseHttpsRedirection();

// NOTE: spelled out rather than left to the implicit one, because
// ApiTokenRestrictionMiddleware below reads [SessionOnly] off the matched endpoint and
// that metadata only exists once routing has run.
app.UseRouting();

app.UseCors();

// NOTE: authentication reads the bearer token into HttpContext.User, authorization then
// enforces [Authorize]. Both have to sit after CORS and before MapControllers.
app.UseAuthentication();
app.UseAuthorization();

// After authorization, so a caller with no credentials at all still gets a 401 rather than
// being told which actions a token it does not have would be refused.
app.UseMiddleware<ApiTokenRestrictionMiddleware>();

app.MapControllers();

app.Run();

// NOTE: exposed so the integration tests can spin the real pipeline up with WebApplicationFactory.
public partial class Program
{
    /// <summary>
    /// Slack over the configured file size for the multipart envelope itself — boundaries,
    /// headers and the other fields of the form.
    /// </summary>
    private const long RequestOverheadBytes = 1024 * 1024;
}
