using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class PostThumbnailTrailer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Medias_PostId",
                table: "Medias");

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "Posts",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DemoUrl",
                table: "Posts",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Domain",
                table: "Posts",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RepoUrl",
                table: "Posts",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SpecUrl",
                table: "Posts",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Role",
                table: "Medias",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Handle",
                table: "Authors",
                type: "character varying(60)",
                maxLength: 60,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_Medias_PostId_Role",
                table: "Medias",
                columns: new[] { "PostId", "Role" },
                unique: true,
                filter: "\"Role\" IN (1, 2)");

            migrationBuilder.CreateIndex(
                name: "IX_Authors_Handle",
                table: "Authors",
                column: "Handle",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Medias_PostId_Role",
                table: "Medias");

            migrationBuilder.DropIndex(
                name: "IX_Authors_Handle",
                table: "Authors");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "DemoUrl",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "Domain",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "RepoUrl",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "SpecUrl",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "Role",
                table: "Medias");

            migrationBuilder.DropColumn(
                name: "Handle",
                table: "Authors");

            migrationBuilder.CreateIndex(
                name: "IX_Medias_PostId",
                table: "Medias",
                column: "PostId");
        }
    }
}
