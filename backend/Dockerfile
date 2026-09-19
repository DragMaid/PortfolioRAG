# The API. The same image also runs the schema migration: `docker run <image> --migrate`
# applies pending EF migrations and exits, which is what the `migrate` service in
# docker-compose.prod.yml does before `api` is allowed to start.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

WORKDIR /src

# Restore before copying the source, so a code change does not re-download every package.
COPY backend.csproj ./
RUN dotnet restore backend.csproj

COPY . ./
RUN dotnet publish backend.csproj --configuration Release --no-restore --output /app


FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime

WORKDIR /app
COPY --from=build /app ./

ENV ASPNETCORE_HTTP_PORTS=8080 \
    ASPNETCORE_ENVIRONMENT=Production

EXPOSE 8080

# The base image ships a non-root `app` user; nothing here needs root.
USER $APP_UID

ENTRYPOINT ["dotnet", "backend.dll"]
