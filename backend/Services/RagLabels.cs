namespace Backend.Services;

/// <summary>
/// How a source is labelled in the index. Shared with <c>rag/src/rag/corpus.py</c>, which
/// writes the same labels onto passages and source rows; if the two disagree the studio shows
/// the worker's once a run settles, so a mismatch is cosmetic rather than broken.
/// </summary>
public static class RagLabels
{
    public static string Profile(string name) => $"{name} — profile";

    public static string Experience(string company, string role) => $"{company} — {role}";
}
