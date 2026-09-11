namespace Backend.Models.Requests;

public class PostQueryRequest : PagedRequest
{
    public string? Search { get; set; }

    public int? AuthorId { get; set; }

    public bool? IsDraft { get; set; }

    /// <summary>Narrows to showcase posts, or to everything but them. Null leaves both in.</summary>
    public bool? IsFeatured { get; set; }

    public PostSortOrder Sort { get; set; } = PostSortOrder.Newest;
}

public enum PostSortOrder
{
    Newest = 0,
    Oldest = 1,
    MostViewed = 2,
    Title = 3
}
