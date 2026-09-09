using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using Backend.Common;
using Backend.Common.OpenApi;
using Backend.Common.Options;
using Backend.Common.Security;
using Backend.Data;
using Backend.Repositories;
using Backend.Services;
using FileSignatures;
using Microsoft.AspNetCore.Authentication.JwtBearer;
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
builder.Services.AddScoped<IMediaRepository, MediaRepository>();

builder.Services.AddScoped<IAuthorService, AuthorService>();
builder.Services.AddScoped<IPostService, PostService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IMediaService, MediaService>();

// ---------------------------------------------------------------------------
// Media storage
// ---------------------------------------------------------------------------

// NOTE: If backblaze service not configured then fail the program
var backblazeOptions = builder.Configuration
    .GetSection(BackblazeOptions.SectionName)
    .Get<BackblazeOptions>() ?? new BackblazeOptions();
if (!noCheck)
    backblazeOptions.Validate();

var mediaOptions = builder.Configuration
    .GetSection(MediaOptions.SectionName)
    .Get<MediaOptions>() ?? new MediaOptions();
if (!noCheck)
    mediaOptions.Validate();

builder.Services.Configure<BackblazeOptions>(builder.Configuration.GetSection(BackblazeOptions.SectionName));
builder.Services.Configure<MediaOptions>(builder.Configuration.GetSection(MediaOptions.SectionName));

// The Backblaze client caches authorization and upload URLs here; the download tokens
// BackblazeService hands out share the same cache.
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<IImageOptimizer, ImageOptimizer>();

// FileSignatures assembly to collect the format list, and it holds no per-call state.
builder.Services.AddSingleton<IFileFormatInspector>(_ => new FileFormatInspector());
builder.Services.AddSingleton<IMediaTypeDetector, FileSignatureMediaTypeDetector>();

// Only reachable under --noCheck, which Validate() above would otherwise have stopped. The
// storage client cannot be constructed without credentials, so the media surface is served
// by a stand-in that answers 503 rather than by nothing at all.
if (backblazeOptions.IsConfigured)
{
    builder.Services.AddBackblazeAgent(options =>
    {
        options.KeyId = backblazeOptions.KeyId;
        options.ApplicationKey = backblazeOptions.ApplicationKey;
    });

    builder.Services.AddSingleton<IBackblazeService, BackblazeService>();
}
else
{
    builder.Services.AddSingleton<IBackblazeService, UnconfiguredBackblazeService>();
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

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
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
        Description = "The accessToken returned by POST /api/auth/login."
    });

    settings.OperationProcessors.Add(new BearerSecurityProcessor("Bearer"));
});

var app = builder.Build();
app.UseExceptionHandler();

// NOTE: Said once at boot rather than from the stand-in service, which is not constructed until the first media request
if (!backblazeOptions.IsConfigured)
{
    app.Logger.LogWarning(
        "Backblaze is not configured: media storage is disabled and every media request will answer " +
        "503. Supply KeyId, ApplicationKey and BucketName under the '{SectionName}' section to enable it.",
        BackblazeOptions.SectionName);
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

    await context.Database.MigrateAsync();
    await BlogDbSeeder.SeedAsync(context, timeProvider);
}

app.UseHttpsRedirection();
app.UseCors();

// NOTE: authentication reads the bearer token into HttpContext.User, authorization then
// enforces [Authorize]. Both have to sit after CORS and before MapControllers.
app.UseAuthentication();
app.UseAuthorization();

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
