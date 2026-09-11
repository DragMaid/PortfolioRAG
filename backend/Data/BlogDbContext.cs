using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Data;

public class BlogDbContext : DbContext
{
    public BlogDbContext(DbContextOptions<BlogDbContext> options) : base(options) { }

    public DbSet<Post> Posts => Set<Post>();

    public DbSet<Author> Authors => Set<Author>();

    public DbSet<Media> Medias => Set<Media>();

    public DbSet<Experience> Experiences => Set<Experience>();

    public DbSet<ContactChannel> ContactChannels => Set<ContactChannel>();

    public DbSet<ExternalLogin> ExternalLogins => Set<ExternalLogin>();

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    public DbSet<PageView> PageViews => Set<PageView>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Author>(entity =>
        {
            entity.HasKey(a => a.Id);
            entity.Property(a => a.Name).IsRequired().HasMaxLength(100);
            entity.Property(a => a.Email).IsRequired().HasMaxLength(256);
            entity.Property(a => a.AvatarObjectKey).HasMaxLength(512);
            entity.Property(a => a.Title).HasMaxLength(150);
            entity.Property(a => a.Headline).HasMaxLength(400);
            entity.Property(a => a.Biography).HasMaxLength(3000);
            entity.Property(a => a.FooterBio).HasMaxLength(500);
            entity.Property(a => a.Location).HasMaxLength(120);
            entity.Property(a => a.Availability).HasMaxLength(160);
            entity.Property(a => a.Focus).HasMaxLength(160);
            entity.Property(a => a.ContactPitch).HasMaxLength(500);
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
            entity.Property(m => m.Caption).HasMaxLength(200);
            entity.HasIndex(m => m.ObjectKey).IsUnique();

            // NOTE: a media row is meaningless without the post it belongs to, so the
            // database drops it with the post rather than the repository doing it by hand.
            entity.HasOne(m => m.Post)
                .WithMany(p => p.Medias)
                .HasForeignKey(m => m.PostId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Experience>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Company).IsRequired().HasMaxLength(120);
            entity.Property(e => e.Role).IsRequired().HasMaxLength(160);
            entity.Property(e => e.Team).HasMaxLength(200);
            entity.Property(e => e.Description).HasMaxLength(4000);
            entity.Property(e => e.LogoObjectKey).HasMaxLength(512);

            // The timeline is always read in date order for one author.
            entity.HasIndex(e => new { e.AuthorId, e.StartedOn });

            entity.HasOne(e => e.Author)
                .WithMany(a => a.Experiences)
                .HasForeignKey(e => e.AuthorId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ContactChannel>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.Property(c => c.Label).IsRequired().HasMaxLength(120);
            entity.Property(c => c.Url).IsRequired().HasMaxLength(500);
            entity.Property(c => c.Handle).HasMaxLength(150);

            entity.HasIndex(c => new { c.AuthorId, c.SortOrder });

            entity.HasOne(c => c.Author)
                .WithMany(a => a.ContactChannels)
                .HasForeignKey(c => c.AuthorId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PageView>(entity =>
        {
            entity.HasKey(v => v.Id);
            entity.Property(v => v.Path).IsRequired().HasMaxLength(400);
            entity.Property(v => v.VisitorHash).IsRequired().HasMaxLength(64);
            entity.Property(v => v.ReferrerHost).HasMaxLength(255);

            // NOTE: index chosen because analytics is also time sensitive
            entity.HasIndex(v => new { v.AuthorId, v.OccurredAt });
            entity.HasIndex(v => new { v.PostId, v.OccurredAt });

            // NOTE: deleting a post keeps its analytics, just referenced to null
            entity.HasOne(v => v.Post)
                .WithMany()
                .HasForeignKey(v => v.PostId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(v => v.Author)
                .WithMany()
                .HasForeignKey(v => v.AuthorId)
                .OnDelete(DeleteBehavior.SetNull);
        });
    }
}

