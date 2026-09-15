using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class RagPipeline : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:vector", ",,");

            migrationBuilder.CreateTable(
                name: "LlmCredentials",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AuthorId = table.Column<int>(type: "integer", nullable: false),
                    Provider = table.Column<int>(type: "integer", nullable: false),
                    KeyCiphertext = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false),
                    KeyPreview = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Model = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    ValidatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ValidationError = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsPublicFitEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    DailyVisitorLimit = table.Column<int>(type: "integer", nullable: false),
                    MonthlyAccountLimit = table.Column<int>(type: "integer", nullable: false),
                    MonthlyBudgetUsd = table.Column<decimal>(type: "numeric(10,4)", precision: 10, scale: 4, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LlmCredentials", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LlmCredentials_Authors_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "Authors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RagDocuments",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AuthorId = table.Column<int>(type: "integer", nullable: false),
                    SourceType = table.Column<int>(type: "integer", nullable: false),
                    SourceId = table.Column<int>(type: "integer", nullable: false),
                    SourceLabel = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    ChunkIndex = table.Column<int>(type: "integer", nullable: false),
                    Content = table.Column<string>(type: "text", nullable: false),
                    ContentHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    MetadataJson = table.Column<string>(type: "jsonb", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RagDocuments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RagDocuments_Authors_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "Authors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RagIndexStates",
                columns: table => new
                {
                    AuthorId = table.Column<int>(type: "integer", nullable: false),
                    BuiltAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    DocumentCount = table.Column<int>(type: "integer", nullable: false),
                    CorpusHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Error = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RagIndexStates", x => x.AuthorId);
                    table.ForeignKey(
                        name: "FK_RagIndexStates_Authors_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "Authors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RagJobs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthorId = table.Column<int>(type: "integer", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    PayloadJson = table.Column<string>(type: "jsonb", nullable: false),
                    ResultJson = table.Column<string>(type: "jsonb", nullable: true),
                    Error = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    MaxAttempts = table.Column<int>(type: "integer", nullable: false),
                    LockedBy = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    LockedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AvailableAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    StartedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    VisitorHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    InputTokens = table.Column<int>(type: "integer", nullable: false),
                    OutputTokens = table.Column<int>(type: "integer", nullable: false),
                    CostUsd = table.Column<decimal>(type: "numeric(12,6)", precision: 12, scale: 6, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RagJobs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RagJobs_Authors_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "Authors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LlmCredentials_AuthorId",
                table: "LlmCredentials",
                column: "AuthorId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RagDocuments_AuthorId",
                table: "RagDocuments",
                column: "AuthorId");

            migrationBuilder.CreateIndex(
                name: "IX_RagDocuments_AuthorId_SourceType_SourceId_ChunkIndex",
                table: "RagDocuments",
                columns: new[] { "AuthorId", "SourceType", "SourceId", "ChunkIndex" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RagJobs_AuthorId_CreatedAt",
                table: "RagJobs",
                columns: new[] { "AuthorId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_RagJobs_Status_AvailableAt",
                table: "RagJobs",
                columns: new[] { "Status", "AvailableAt" });

            migrationBuilder.CreateIndex(
                name: "IX_RagJobs_VisitorHash_CreatedAt",
                table: "RagJobs",
                columns: new[] { "VisitorHash", "CreatedAt" });

            // ----------------------------------------------------------------
            // The two columns retrieval actually reads, neither of which EF can model.
            // ----------------------------------------------------------------
            //
            // Hand-written rather than scaffolded, and deliberately not represented on
            // RagDocument: a property EF maps to a type it does not understand is worse
            // than a column it has never heard of. Nothing in the API reads either of
            // these — the Python worker writes the embedding and Postgres maintains the
            // tsvector — so the model staying quiet about them costs nothing and keeps
            // `dotnet ef migrations add` from trying to drop them later.

            // 384 dimensions, which is bge-small-en-v1.5's output and therefore a property
            // of the embedding model rather than a free choice: changing the model means
            // changing this number and re-embedding the corpus, which is why the worker
            // refuses to start when its model's width disagrees with the column.
            migrationBuilder.Sql(
                """
                ALTER TABLE "RagDocuments"
                ADD COLUMN "Embedding" vector(384);
                """);

            // The keyword half of retrieval. GENERATED so it cannot drift from the content
            // it summarises — a trigger would have been one more thing to get right, and a
            // column the worker had to remember to write would eventually not be written.
            // The label is included because a passage is often matched by the name of the
            // project it came from rather than by anything in its body.
            migrationBuilder.Sql(
                """
                ALTER TABLE "RagDocuments"
                ADD COLUMN "SearchVector" tsvector
                GENERATED ALWAYS AS (
                    to_tsvector(
                        'english',
                        coalesce("SourceLabel", '') || ' ' || coalesce("Content", ''))
                ) STORED;
                """);

            // HNSW over cosine distance. Cosine because the embeddings are normalised and
            // the question is direction, not magnitude; HNSW rather than IVFFlat because it
            // needs no training pass over a corpus that starts empty and is rebuilt
            // whenever the portfolio changes.
            migrationBuilder.Sql(
                """
                CREATE INDEX "IX_RagDocuments_Embedding"
                ON "RagDocuments"
                USING hnsw ("Embedding" vector_cosine_ops);
                """);

            migrationBuilder.Sql(
                """
                CREATE INDEX "IX_RagDocuments_SearchVector"
                ON "RagDocuments"
                USING gin ("SearchVector");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // NOTE: the two hand-added columns and their indexes are dropped with the table
            // that carries them, so there is nothing to undo above and beyond this.
            migrationBuilder.DropTable(
                name: "LlmCredentials");

            migrationBuilder.DropTable(
                name: "RagDocuments");

            migrationBuilder.DropTable(
                name: "RagIndexStates");

            migrationBuilder.DropTable(
                name: "RagJobs");

            migrationBuilder.AlterDatabase()
                .OldAnnotation("Npgsql:PostgresExtension:vector", ",,");
        }
    }
}
