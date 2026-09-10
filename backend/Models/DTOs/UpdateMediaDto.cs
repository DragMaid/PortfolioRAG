using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs;

/// <summary>
/// The editable part of an uploaded file. The bytes, the name and the type are fixed at
/// upload, re-upload to change those, so a caption is all there is to write.
/// </summary>
public class UpdateMediaDto
{
    [StringLength(200)]
    public string? Caption { get; init; }
}
