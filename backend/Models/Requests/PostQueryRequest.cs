namespace Backend.Models.Requests;

public class PostQueryRequest : PagedRequest
{
    public string? Search { get; set; }

    public int? AuthorId { get; set; }

    public bool? IsDraft { get; set; }

    public PostSortOrder Sort { get; set; } = PostSortOrder.Newest;
}

public enum PostSortOrder
{
    Newest = 0,
    Oldest = 1,
    MostViewed = 2,
    Title = 3
}
