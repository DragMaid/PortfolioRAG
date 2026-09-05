namespace Backend.Models.Entities;

// TODO: consider using password for authentication as I dont wanna do OAuth
public class Author
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string? AvatarUrl { get; set; }

    public string? Biography { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public ICollection<Post> Posts { get; set; } = new List<Post>();
}
