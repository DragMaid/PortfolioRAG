using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddMediaObjectKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // NOTE: Url is dropped rather than renamed. It was meant to hold a public
            // address, and media now lives in a private bucket where no such thing exists —
            // ObjectKey holds a bucket key instead, which is not the same value in a
            // different column. Nothing is lost: no code path ever wrote a media row before
            // this migration, so the table is empty wherever it runs. That is also what
            // keeps the unique index below from colliding on the "" default.
            migrationBuilder.DropColumn(
                name: "Url",
                table: "Medias");

            migrationBuilder.AddColumn<long>(
                name: "ByteSize",
                table: "Medias",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "ObjectKey",
                table: "Medias",
                type: "character varying(512)",
                maxLength: 512,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AvatarObjectKey",
                table: "Authors",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Medias_ObjectKey",
                table: "Medias",
                column: "ObjectKey",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Medias_ObjectKey",
                table: "Medias");

            migrationBuilder.DropColumn(
                name: "ByteSize",
                table: "Medias");

            migrationBuilder.DropColumn(
                name: "ObjectKey",
                table: "Medias");

            migrationBuilder.DropColumn(
                name: "AvatarObjectKey",
                table: "Authors");

            migrationBuilder.AddColumn<string>(
                name: "Url",
                table: "Medias",
                type: "character varying(256)",
                maxLength: 256,
                nullable: false,
                defaultValue: "");
        }
    }
}
