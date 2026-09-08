using Backend.Common.Exceptions;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Common;

/// <summary>
/// This handler will handle most custom exceptions translation while coverting
/// all others into default 500 following RFC 7807 problem response to avoid internal leaks.
/// </summary>
public class DefaultExceptionHandler : IExceptionHandler
{
    private readonly IProblemDetailsService _problemDetailsService;
    private readonly ILogger<DefaultExceptionHandler> _logger;

    public DefaultExceptionHandler(
        IProblemDetailsService problemDetailsService,
        ILogger<DefaultExceptionHandler> logger)
    {
        _problemDetailsService = problemDetailsService;
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (statusCode, title) = exception switch
        {
            // NOTE: all custom exceptions must be mapped here
            NotFoundException => (StatusCodes.Status404NotFound, "Resource not found"),
            UnauthorizedException => (StatusCodes.Status401Unauthorized, "Not authenticated"),
            ForbiddenException => (StatusCodes.Status403Forbidden, "Not authorized"),
            NotConfiguredException => (StatusCodes.Status503ServiceUnavailable, "Feature not configured"),
            ConflictException => (StatusCodes.Status409Conflict, "Conflict"),
            ValidationException => (StatusCodes.Status400BadRequest, "Invalid request"),
            PayloadTooLargeException => (StatusCodes.Status413PayloadTooLarge, "Upload too large"),
            InvalidDataException => (StatusCodes.Status413PayloadTooLarge, "Upload too large"),
            UnsupportedMediaTypeException => (StatusCodes.Status415UnsupportedMediaType, "Unsupported file type"),
            _ => (StatusCodes.Status500InternalServerError, "An unexpected error occured")
        };

        if (statusCode == StatusCodes.Status500InternalServerError)
        {
            _logger.LogError(exception, "Unhandled exception while processing {Path}", httpContext.Request.Path);
        }
        else
        {
            _logger.LogInformation("Request to {Path} failed with {StatusCode}: {Message}",
                httpContext.Request.Path, statusCode, exception.Message);
        }

        httpContext.Response.StatusCode = statusCode;

        return await _problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = statusCode,
                Title = title,
                Detail = statusCode == StatusCodes.Status500InternalServerError
                    ? "The request could not be completed."
                    : exception.Message
            }
        });
    }
}
