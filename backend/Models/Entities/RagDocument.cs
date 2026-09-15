namespace Backend.Models.Entities;

/// <summary>Which part of the portfolio a chunk was cut from.</summary>
public enum RagSourceType
{
    /// <summary>The author's own copy — headline, biography, focus, availability.</summary>
    Profile = 0,

    /// <summary>One job on the timeline.</summary>
    Experience = 1,

    /// <summary>One published post.</summary>
    Post = 2
}

/// <summary>
/// One retrievable chunk of an author's portfolio, with its embedding.
///
/// Written only by the Python worker; the API models it so that the migration owns the
/// schema and so the studio can count what is indexed. Two columns are deliberately absent
/// from this class and added by raw SQL in the migration, because EF has no type for
/// either: <c>embedding vector(384)</c> and a generated <c>search tsvector</c>. Retrieval
/// needs both — the vector for meaning, the tsvector for the exact words a job description
/// uses, fused into one ranking. See <c>rag/src/rag/retrieval.py</c>.
/// </summary>
public class RagDocument
{
    public long Id { get; set; }

    public int AuthorId { get; set; }

    public Author Author { get; set; } = null!;

    public RagSourceType SourceType { get; set; }

    /// <summary>
    /// The row this came from, or 0 for <see cref="RagSourceType.Profile"/>, of which an
    /// author has exactly one.
    /// </summary>
    public int SourceId { get; set; }

    /// <summary>
    /// How a citation reads, e.g. "Vector Core", "Stripe — Staff Engineer". Denormalised so
    /// rendering an answer is one query rather than a join per cited chunk.
    /// </summary>
    public string SourceLabel { get; set; } = string.Empty;

    /// <summary>Position within its source, so neighbouring chunks can be stitched back together.</summary>
    public int ChunkIndex { get; set; }

    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// SHA-256 of <see cref="Content"/>. What makes re-indexing cheap: the worker re-cuts
    /// the whole corpus every time and only pays to embed the chunks whose hash it has not
    /// seen, so an unchanged portfolio costs one query rather than one embedding per chunk.
    /// </summary>
    public string ContentHash { get; set; } = string.Empty;

    /// <summary>Whatever the chunker knew about the chunk — section, dates, tags.</summary>
    public string MetadataJson { get; set; } = "{}";

    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>
/// What the last index run over one author's corpus produced.
///
/// Exists so the studio can say "184 passages, rebuilt 9 minutes ago" without counting
/// rows, and so a failed rebuild is visible rather than silently leaving yesterday's index
/// in place.
/// </summary>
public class RagIndexState
{
    /// <summary>The author, which is also the key — an account has one index.</summary>
    public int AuthorId { get; set; }

    public Author Author { get; set; } = null!;

    public DateTimeOffset? BuiltAt { get; set; }

    public int DocumentCount { get; set; }

    /// <summary>
    /// A digest of everything that went into the index. The worker compares it 
    /// before trying to rebuild the vectors, if hash is the same then no need
    /// </summary>
    public string? CorpusHash { get; set; }

    /// <summary>Why the last rebuild failed, or null if the last one worked.</summary>
    public string? Error { get; set; }
}
