using Backend.Common.Exceptions;
// TODO: implement the mapping module later
using Backend.Mapping;
using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services;

public class AuthorService : IAuthorService
{
    private readonly IAuthorRepository _authors;
    private readonly TimeProvider _timeProvider;

    public AuthorService(
        IAuthorRepository authors,
        TimeProvider timeProvider)
    {
        _authors = authors;
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

    public async Task<AuthorDto> CreateAsync(CreateAuthorDto dto, CancellationToken cancellationToken = default)
    {
        var email = dto.Email.Trim();

        if (await _authors.EmailExistsAsync(email, null, cancellationToken))
            throw new ConflictException($"An author with the email '{email}' already exists.");

        var author = new Author
        {
            Name = dto.Name.Trim(),
            Email = email,
            Biography = string.IsNullOrWhiteSpace(dto.Biography) ? null : dto.Biography.Trim(),
            CreatedAt = _timeProvider.GetUtcNow()
        };

        await _authors.AddAsync(author, cancellationToken);
        await _authors.SaveChangesAsync(cancellationToken);
        return author.ToDto();
    }

    public async Task<AuthorDto> UpdateAsync(
        int id,
        UpdateAuthorDto dto,
        CancellationToken cancellationToken = default)
    { 
        var author = await _authors.GetByIdAsync(id, tracked: false, cancellationToken)
            ?? throw NotFoundException.For("Author", id);

        var email = dto.Email.Trim();

        if (await _authors.EmailExistsAsync(email, id, cancellationToken))
            throw new ConflictException($"An author with the email '{email}' already exists.");

        author.Name = dto.Name.Trim();
        author.Email = email;
        author.Biography = string.IsNullOrWhiteSpace(dto.Biography) ? null : dto.Biography.Trim();

        await _authors.SaveChangesAsync(cancellationToken);
        return author.ToDto();
    }

    public async Task DeleteAsync(int id, CancellationToken cancellationToken = default)
    { 
        var author = await _authors.GetByIdAsync(id, tracked: true, cancellationToken)
            ?? throw NotFoundException.For("Author", id);

        // TODO: this has post thing doesn't really make sense as It would most
        // probably be deleted on cascade, not handling this for now, remove the haspost check after
        // if (await _authors.HasPostsAsync(id, CancellationToken))
        
        _authors.Remove(author);
        await _authors.SaveChangesAsync(cancellationToken);
    } 
}
