using System.Reflection;
using NetArchTest.Rules;
using VioletCode.Modules.Catalogs;
using VioletCode.SharedKernel.Modules;

namespace VioletCode.ArchitectureTests;

/// <summary>
/// Reglas del monolito modular (ADR-0003). Si una prueba falla, alguien cruzó un límite entre módulos.
/// </summary>
public class ModuleBoundaryTests
{
    private static readonly string[] ModuleNames =
        ["Identity", "Alerts", "Cases", "Scheduling", "Catalogs", "Notifications", "Analytics", "Audit"];

    private static Assembly ModuleAssembly(string name) =>
        Assembly.Load($"VioletCode.Modules.{name}");

    public static TheoryData<string> Modules()
    {
        var data = new TheoryData<string>();
        foreach (var m in ModuleNames) data.Add(m);
        return data;
    }

    [Theory]
    [MemberData(nameof(Modules))]
    public void Un_modulo_no_depende_de_otro_modulo(string module)
    {
        _ = typeof(CatalogsModule); // fuerza la carga de ensamblados de módulos
        var others = ModuleNames.Where(m => m != module).Select(m => $"VioletCode.Modules.{m}").ToArray();

        var result = Types.InAssembly(ModuleAssembly(module))
            .ShouldNot().HaveDependencyOnAny(others)
            .GetResult();

        Assert.True(result.IsSuccessful,
            $"{module} depende de otro módulo: {string.Join(", ", result.FailingTypeNames ?? [])}");
    }

    [Fact]
    public void SharedKernel_no_depende_de_modulos()
    {
        var result = Types.InAssembly(typeof(IModule).Assembly)
            .ShouldNot().HaveDependencyOnAny(ModuleNames.Select(m => $"VioletCode.Modules.{m}").ToArray())
            .GetResult();

        Assert.True(result.IsSuccessful);
    }

    [Theory]
    [MemberData(nameof(Modules))]
    public void El_dominio_no_depende_de_infraestructura(string module)
    {
        var result = Types.InAssembly(ModuleAssembly(module))
            .That().ResideInNamespace($"VioletCode.Modules.{module}.Domain")
            .ShouldNot().HaveDependencyOnAny("Microsoft.EntityFrameworkCore", "Microsoft.AspNetCore")
            .GetResult();

        Assert.True(result.IsSuccessful,
            $"Dominio de {module} depende de infraestructura: {string.Join(", ", result.FailingTypeNames ?? [])}");
    }
}
