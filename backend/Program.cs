using System.Text;
using System.Text.Json.Serialization;
using Backend.Common;
using Backend.Common.OpenApi;
using Backend.Common.Options;
using Backend.Common.Security;
using Backend.Data;
using Backend.Repositories;
using Backend.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using NSwag;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

// Change the enum interger over json transfer to string
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

// TODO: move to postgresql instead
builder.Services.AddDbContext<BlogDbContext>(options =>
    options.UseInMemoryDatabase("BlogDB"));

builder.Services.AddSingleton(TimeProvider.System);

builder.Services.AddScoped<IAuthorRepository, AuthorRepository>();
builder.Services.AddScoped<IPostRepository, PostRepository>();
builder.Services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();

builder.Services.AddScoped<IAuthorService, AuthorService>();
builder.Services.AddScoped<IPostService, PostService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ITokenService, TokenService>();

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
jwtOptions.Validate();

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
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
            // An access token lives ~15 minutes; letting an expired one linger for another
            // five would defeat the point.
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

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseOpenApi();
    app.UseSwaggerUi();

    // NOTE: this part will seed the database if the service is in development mode
    using var scope = app.Services.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<BlogDbContext>();
    var timeProvider = scope.ServiceProvider.GetRequiredService<TimeProvider>();

    // TODO: make it so only in developmental mode will the seeder be ran
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
public partial class Program;
