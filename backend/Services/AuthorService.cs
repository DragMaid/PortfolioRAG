using Backend.Common.Exceptions;
using Backend.Common.Security;
using Backend.Mapping;
using Backend.Models.DTOs;
using Backend.Repositories;

namespace Backend.Services;

public class AuthorService : IAuthorService
{
    private readonly IAuthorRepository _authors;
    private readonly ICurrentUser _currentUser;
    private readonly TimeProvider _timeProvider;

    public AuthorService(
        IAuthorRepository authors,
        ICurrentUser currentUser,
        TimeProvider timeProvider)
    {
        _authors = authors;
        _currentUser = currentUser;
        _timeProvider = timeProvider;
    }

    public async Task<IReadOnlyList<AuthorDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var authors = await _authors.GetAllAsync(cancellationToken);
        return authors.Select(a => a.ToDto()).ToList();
    }

    public async Task<AuthorDto> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        var author = await _authors.GetByIdAsync(id, tracked: false, cancellationToken)
            ?? throw NotFoundException.For("Author", id);
        return author.ToDto();
    }

    public async Task<AuthorDto> UpdateAsync(
        int id,
        UpdateAuthorDto dto,
        CancellationToken cancellationToken = default)
    {
        EnsureSelf(id);

        var author = await _authors.GetByIdAsync(id, tracked: true, cancellationToken)
            ?? throw NotFoundException.For("Author", id);

        var email = dto.Email.Trim().ToLowerInvariant();

        if (await _authors.EmailExistsAsync(email, id, cancellationToken))
            throw new ConflictException($"An author with the email '{email}' already exists.");

        // NOTE: making sure that the new linked email is not the current one being used
        if (!string.Equals(author.Email, email, StringComparison.OrdinalIgnoreCase))
        {
            author.EmailConfirmedAt = null;
        }

        author.Name = dto.Name.Trim();
        author.Email = email;
        author.Biography = string.IsNullOrWhiteSpace(dto.Biography) ? null : dto.Biography.Trim();
        author.AvatarUrl = string.IsNullOrWhiteSpace(dto.AvatarUrl) ? null : dto.AvatarUrl.Trim();

        await _authors.SaveChangesAsync(cancellationToken);
        return author.ToDto();
    }

    public async Task DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        EnsureSelf(id);

        var author = await _authors.GetByIdAsync(id, tracked: true, cancellationToken)
            ?? throw NotFoundException.For("Author", id);

        // NOTE: closing an account takes everything with it — posts, their media, the
        // external logins and every refresh token
        _authors.Remove(author);
        await _authors.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// An author account may only be changed by its owner — there is no administrator who
    /// can edit or delete somebody else's.
    /// </summary>
    private void EnsureSelf(int id)
    {
        if (id != _currentUser.RequireAuthorId())
            throw ForbiddenException.For("author", id);
    }
}
