using System.ComponentModel.DataAnnotations;

namespace Backend.Models.Requests;

public abstract class PagedRequest
{
    public const int MaxPageSize = 100;

    [Range(1, int.MaxValue)]
    public int Page { get; set; } = 1;

    [Range(1, MaxPageSize)]
    public int PageSize { get; set; } = 10;

    public int Skip => (Page - 1) * PageSize;
}
