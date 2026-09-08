using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Data;

public class BlogDbContext : DbContext
{
    public BlogDbContext(DbContextOptions<BlogDbContext> options) : base(options) { }

    public DbSet<Post> Posts => Set<Post>();

    public DbSet<Author> Authors => Set<Author>();

    public DbSet<Media> Medias => Set<Media>();

    public DbSet<ExternalLogin> ExternalLogins => Set<ExternalLogin>();

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Author>(entity =>
        {
            entity.HasKey(a => a.Id);
            entity.Property(a => a.Name).IsRequired().HasMaxLength(100);
            entity.Property(a => a.Email).IsRequired().HasMaxLength(256);
            entity.Property(a => a.AvatarUrl).HasMaxLength(256);
            entity.Property(a => a.AvatarObjectKey).HasMaxLength(512);
            entity.Property(a => a.Biography).HasMaxLength(1000);
            // NOTE: stored lowercase so the unique index doubles as case-insensitive lookup.
            entity.HasIndex(a => a.Email).IsUnique();
            entity.Property(a => a.PasswordHash).HasMaxLength(512);
        });

        modelBuilder.Entity<ExternalLogin>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Subject).IsRequired().HasMaxLength(256);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(256);
            // NOTE: one provider account maps to exactly one author.
            entity.HasIndex(e => new { e.Provider, e.Subject }).IsUnique();

            entity.HasOne(e => e.Author)
                .WithMany(a => a.ExternalLogins)
                .HasForeignKey(e => e.AuthorId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.Property(t => t.TokenHash).IsRequired().HasMaxLength(128);
            entity.Property(t => t.ReplacedByTokenHash).HasMaxLength(128);
            entity.HasIndex(t => t.TokenHash).IsUnique();

            entity.HasOne(t => t.Author)
                .WithMany(a => a.RefreshTokens)
                .HasForeignKey(t => t.AuthorId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Post>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Title).IsRequired().HasMaxLength(200);
            entity.Property(p => p.Slug).IsRequired().HasMaxLength(200);
            entity.Property(p => p.Summary).HasMaxLength(500);
            entity.Property(p => p.Body).IsRequired();
            entity.HasIndex(p => p.Slug).IsUnique();

            // NOTE: deleting an account takes its posts — and, through them, their media —
            // with it. Nothing of a closed account survives. See AuthorService.DeleteAsync.
            entity.HasOne(p => p.Author)
                .WithMany(a => a.Posts)
                .HasForeignKey(p => p.AuthorId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Media>(entity =>
        {
            entity.HasKey(m => m.Id);
            entity.Property(m => m.Filename).IsRequired().HasMaxLength(100);
            entity.Property(m => m.ObjectKey).IsRequired().HasMaxLength(512);
            entity.Property(m => m.Extension).IsRequired();
            entity.HasIndex(m => m.ObjectKey).IsUnique();

            // NOTE: a media row is meaningless without the post it belongs to, so the
            // database drops it with the post rather than the repository doing it by hand.
            entity.HasOne(m => m.Post)
                .WithMany(p => p.Medias)
                .HasForeignKey(m => m.PostId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}

