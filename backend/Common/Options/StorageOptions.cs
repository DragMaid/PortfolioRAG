namespace Backend.Common.Options;

public enum StorageProvider
{
    Backblaze = 0,
    S3 = 1
}

public class StorageOptions
{
    public const string SectionName = "Storage";

    public StorageProvider Provider { get; set; } = StorageProvider.Backblaze;
}
