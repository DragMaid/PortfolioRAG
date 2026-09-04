namespace Backend.Models.Entities;

public class Author
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string Biography { get; set; } = string.Empty;

    public string AvatarUrl { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public ICollection<Post> Posts { get; set; } = new List<Post>();
}
