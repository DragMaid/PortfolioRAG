using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Backend.Common;

public static partial class SlugGenerator
{
    // Allow the constructor to define this instead
    private const int MaxLength = 200;

    public static string Generate(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return string.Empty;
        }

        var normalized = text.Normalize(NormalizationForm.FormD);
        // NOTE: using string builder here to avoid allocating new memories for string construction each time
        var builder = new StringBuilder(normalized.Length);

        foreach (var c in normalized)
        {
            // Skipping the characters with specific accents (ex: dau cau in vietnamese)
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark)
                continue;
            builder.Append(c);
        }

        var slug = builder.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();
        // NOTE: the below would be equivalent to
        // Regex regex = NonSlugCharacters();
        // slug = regex.Replace(slug, "-");
        slug = NonSlugCharacters().Replace(slug, "-");
        slug = RepeatedHyphens().Replace(slug, "-").Trim('-');

        // return substr of slug till MaxLength
        return slug.Length > MaxLength ? slug[..MaxLength].TrimEnd('-') : slug;
    }

    public static async Task<string> GenerateUniqueAsync(
        string text,
        Func<string, Task<bool>> isTaken,
        CancellationToken cancellationToken = default)
    {
        var baseSlug = Generate(text);

        if (string.IsNullOrEmpty(baseSlug))
            baseSlug = "post";

        var candidate = baseSlug;
        var suffix = 1;

        // NOTE: the isTaken function reference is passed inside to be used
        while (await isTaken(candidate))
        {
            cancellationToken.ThrowIfCancellationRequested();
            suffix++;

            var suffixText = $"-{suffix}";
            var trimmed = baseSlug.Length + suffixText.Length > MaxLength
                ? baseSlug[..(MaxLength - suffixText.Length)].TrimEnd('-')
                : baseSlug;

            candidate = trimmed + suffixText;
        }

        return candidate;
    }

    // NOTE: this regex generator along with partial to fill in the function implementation
    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NonSlugCharacters();

    [GeneratedRegex("-{2,}")]
    private static partial Regex RepeatedHyphens();
}
