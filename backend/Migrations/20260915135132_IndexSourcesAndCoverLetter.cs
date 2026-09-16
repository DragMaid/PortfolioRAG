using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class IndexSourcesAndCoverLetter : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Category",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "Domain",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "SpecUrl",
                table: "Posts");

            migrationBuilder.CreateTable(
                name: "RagSources",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AuthorId = table.Column<int>(type: "integer", nullable: false),
                    SourceType = table.Column<int>(type: "integer", nullable: false),
                    SourceId = table.Column<int>(type: "integer", nullable: false),
                    Label = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Error = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    PassageCount = table.Column<int>(type: "integer", nullable: false),
                    QueuedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    IndexedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RagSources", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RagSources_Authors_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "Authors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RagSources_AuthorId_SourceType_SourceId",
                table: "RagSources",
                columns: new[] { "AuthorId", "SourceType", "SourceId" },
                unique: true);

            // NOTE: an account that already has a key and an index has no source rows yet, and
            // its corpus hash would let the worker skip the run that writes them. Clearing the
            // hash and queueing one rebuild per key lists everything on the next pass.
            migrationBuilder.Sql("""UPDATE "RagIndexStates" SET "CorpusHash" = NULL;""");

            migrationBuilder.Sql("""
                INSERT INTO "RagJobs"
                    ("Id", "AuthorId", "Kind", "Status", "PayloadJson", "Attempts", "MaxAttempts",
                     "AvailableAt", "CreatedAt", "InputTokens", "OutputTokens", "CostUsd")
                SELECT gen_random_uuid(), c."AuthorId", 0, 0, '{"force": true}'::jsonb, 0, 3,
                       now(), now(), 0, 0, 0
                FROM "LlmCredentials" c;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RagSources");

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "Posts",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Domain",
                table: "Posts",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SpecUrl",
                table: "Posts",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }
    }
}
