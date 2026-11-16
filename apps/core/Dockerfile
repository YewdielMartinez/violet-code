# Build multi-etapa de Violet Code Core
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY global.json Directory.Build.props VioletCode.sln ./
COPY src/ src/
COPY tests/ tests/
RUN dotnet restore src/VioletCode.Api/VioletCode.Api.csproj
RUN dotnet publish src/VioletCode.Api/VioletCode.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=build /app ./
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
# Usuario sin privilegios incluido en la imagen oficial
USER app
ENTRYPOINT ["dotnet", "VioletCode.Api.dll"]
