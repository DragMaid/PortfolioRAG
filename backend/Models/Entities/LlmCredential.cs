namespace Backend.Models.Entities;

public enum LlmProvider
{
    Anthropic = 0,
    OpenAI = 1,
    Gemini = 2
}

/// <summary>
/// The provider key an author supplies so their portfolio can answer questions about
/// itself, together with the ceilings that stop a public button from spending it freely.
///
/// One per account. The key itself is never stored in the clear and never leaves the API:
/// <see cref="KeyCiphertext"/> is sealed with AES-GCM under a deployment-wide key (see
/// <c>SecretProtector</c>), and the only two things that ever unseal it are the validation
/// call and the worker that runs the pipeline.
///
/// Unlike an <see cref="ApiToken"/>, this is a credential the account <em>holds</em> rather
/// than one it <em>issues</em> — it authenticates us to somebody else. That is why it can
/// be replaced but never read back, and why every endpoint that touches it is
/// <c>[SessionOnly]</c>: a leaked API token that could read this would leak a second,
/// billable credential with it.
/// </summary>
public class LlmCredential
{
    public int Id { get; set; }

    public int AuthorId { get; set; }

    public Author Author { get; set; } = null!;

    public LlmProvider Provider { get; set; }

    /// <summary>
    /// The sealed key: nonce, tag and ciphertext in one base64 string. Opaque here on
    /// purpose — nothing outside <c>SecretProtector</c> should know its shape.
    /// </summary>
    public string KeyCiphertext { get; set; } = string.Empty;

    /// <summary>
    /// Enough of the raw key to recognise which one this is — "sk-ant-…4f2a". The same
    /// bargain <see cref="ApiToken.Prefix"/> strikes: recognisable, not reconstructible.
    /// </summary>
    public string KeyPreview { get; set; } = string.Empty;

    /// <summary>
    /// The model the pipeline asks for. Stored rather than hard-coded so an author can move
    /// to a cheaper or newer one without a deployment.
    /// </summary>
    public string Model { get; set; } = string.Empty;

    /// <summary>
    /// When the provider last confirmed the key works. Null means it has never been
    /// confirmed, and nothing public is served until it has — see
    /// <see cref="IsUsable"/>.
    /// </summary>
    public DateTimeOffset? ValidatedAt { get; set; }

    /// <summary>
    /// What the provider said when validation last failed, kept so the studio can show the
    /// difference between "wrong key" and "we could not reach them".
    /// </summary>
    public string? ValidationError { get; set; }

    /// <summary>
    /// Whether visitors to the public portfolio get the "Check job fit" button.
    ///
    /// Separate from <see cref="ValidatedAt"/> because a working key is not consent: saving
    /// one lets the author try the pipeline from the studio, and this is the deliberate
    /// second act that puts it in front of strangers.
    /// </summary>
    public bool IsPublicFitEnabled { get; set; }

    /// <summary>How many public analyses one visitor may run in a rolling day.</summary>
    public int DailyVisitorLimit { get; set; } = DefaultDailyVisitorLimit;

    /// <summary>How many public analyses the whole account will serve in a calendar month.</summary>
    public int MonthlyAccountLimit { get; set; } = DefaultMonthlyAccountLimit;

    /// <summary>
    /// What the account is willing to spend in a calendar month. The count above bounds
    /// traffic; this bounds the bill, and a long job description can cost several times
    /// what a short one does.
    /// </summary>
    public decimal MonthlyBudgetUsd { get; set; } = DefaultMonthlyBudgetUsd;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public const int DefaultDailyVisitorLimit = 20;

    public const int DefaultMonthlyAccountLimit = 500;

    public const decimal DefaultMonthlyBudgetUsd = 10m;

    /// <summary>
    /// Whether the pipeline may run at all on this credential. The studio's own trial runs
    /// need this much; the public button needs this <em>and</em>
    /// <see cref="IsPublicFitEnabled"/>.
    /// </summary>
    public bool IsUsable => ValidatedAt is not null;
}
