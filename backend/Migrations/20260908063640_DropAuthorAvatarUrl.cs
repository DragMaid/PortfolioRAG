using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class DropAuthorAvatarUrl : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // NOTE: an avatar is now only ever a file in the bucket. This column held a
            // picture URL a sign-in provider handed us, which nothing reads any more.
            migrationBuilder.DropColumn(
                name: "AvatarUrl",
                table: "Authors");

            // MediaExtension.Svg (4) is retired along with SVG support. The value is stored
            // as a plain integer, so a row left behind would deserialize to an enum member
            // that no longer exists. Only a developer's local database can have one.
            migrationBuilder.Sql("DELETE FROM \"Medias\" WHERE \"Extension\" = 4;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AvatarUrl",
                table: "Authors",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);
        }
    }
}
