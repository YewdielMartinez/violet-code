using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VioletCode.Modules.Alerts.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialAlerts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "alerts");

            migrationBuilder.CreateTable(
                name: "alerts",
                schema: "alerts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Folio = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Priority = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Channel = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Colonia = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    AssignedToName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    ClosedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_alerts", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_alerts_Folio",
                schema: "alerts",
                table: "alerts",
                column: "Folio",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_alerts_Status_CreatedAt",
                schema: "alerts",
                table: "alerts",
                columns: new[] { "Status", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "alerts",
                schema: "alerts");
        }
    }
}
