using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

// Change the enum interger over json transfer to string
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

// TODO: write the db context here for the whole database
// builder.Services.AddDbContext<>(options =>
//     options.UseInMemoryDatabase("BlogDB"));

builder.Services.AddSingleton(TimeProvider.System);

// TODO: add repository scopes here
// builder.Services.AddScoped<>();

// NOTE: this one add problem+json instead of 500s for debuggability
builder.Services.AddProblemDetails();
// TODO: implement the global exception handler
// builder.Services.AddExceptionHandler<>();

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
});

var app = builder.Build();
app.UseExceptionHandler();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseOpenApi();
    app.UseSwaggerUi();


    // NOTE: this part will seed the database if the service is in development mode
    // TODO: add in the context retrieval protocol using dependency injection
    // using var scope = app.Services.CreateScope();
    // var context = scope.ServiceProvider.GetRequiredService<>();
    // var timeProvider = scope.ServiceProvider.GetRequiredService<>();
    // await BlogDbSeeder.SeedAsync(context, timeProvider);
}

// TODO: what does this do ?
// app.UseAuthorization();

app.UseHttpsRedirection();
app.UseCors();
app.MapControllers();

app.Run();
