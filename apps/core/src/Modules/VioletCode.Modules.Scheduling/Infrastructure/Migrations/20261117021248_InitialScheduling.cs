using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VioletCode.Modules.Scheduling.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialScheduling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "scheduling");

            migrationBuilder.CreateTable(
                name: "appointments",
                schema: "scheduling",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CaseFolio = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    StartsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    DurationMinutes = table.Column<int>(type: "integer", nullable: false),
                    Kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ProfessionalName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_appointments", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_appointments_ProfessionalName_StartsAt",
                schema: "scheduling",
                table: "appointments",
                columns: new[] { "ProfessionalName", "StartsAt" });

            migrationBuilder.CreateIndex(
                name: "IX_appointments_StartsAt",
                schema: "scheduling",
                table: "appointments",
                column: "StartsAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "appointments",
                schema: "scheduling");
        }
    }
}
