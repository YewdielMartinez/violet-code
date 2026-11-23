using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VioletCode.Modules.Cases.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCases : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "cases");

            migrationBuilder.CreateTable(
                name: "case_files",
                schema: "cases",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Folio = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Alias = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Area = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    RiskLevel = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    AssignedToName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    OpenedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    NeedsReview = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_case_files", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_case_files_Folio",
                schema: "cases",
                table: "case_files",
                column: "Folio",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_case_files_Status_AssignedToName",
                schema: "cases",
                table: "case_files",
                columns: new[] { "Status", "AssignedToName" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "case_files",
                schema: "cases");
        }
    }
}
