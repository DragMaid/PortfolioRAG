namespace Backend.Models.Entities;

public class Media
{ 
    public int Id { get; set; } 

    public string Filename { get; set; } = String.Empty;

    public string Url { get; set; } = String.Empty;

    public string Extension { get; set; } = String.Empty;

    public int PostId { get; set; }

    public Post Post { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; }
}
