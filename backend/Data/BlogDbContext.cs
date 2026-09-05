using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Data;

public class BlogDbContext : DbContext
{
    public BlogDbContext(DbContextOptions<BlogDbContext> options) : base(options) { }

    public DbSet<Post> Posts => Set<Post>();

    public DbSet<Author> Authors => Set<Author>();

    public DbSet<Media> Medias => Set<Media>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Author>(entity =>
        {
            entity.HasKey(a => a.Id);
            entity.Property(a => a.Name).IsRequired().HasMaxLength(100);
            entity.Property(a => a.Email).IsRequired().HasMaxLength(256);
            entity.Property(a => a.AvatarUrl).HasMaxLength(256);
            entity.Property(a => a.Biography).HasMaxLength(1000);
            entity.HasIndex(a => a.Email).IsUnique();
        });

        modelBuilder.Entity<Post>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Title).IsRequired().HasMaxLength(200);
            entity.Property(p => p.Slug).IsRequired().HasMaxLength(200);
            entity.Property(p => p.Summary).IsRequired().HasMaxLength(500);
            entity.Property(p => p.Body).IsRequired();
            entity.HasIndex(p => p.Slug).IsUnique();

            entity.HasOne(p => p.Author)
                .WithMany(a => a.Posts)
                .HasForeignKey(p => p.AuthorId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Media>(entity =>
        {
            entity.HasKey(m => m.Id);
            entity.Property(m => m.Filename).IsRequired().HasMaxLength(100);
            entity.Property(m => m.Url).IsRequired().HasMaxLength(256);
            // TODO: maybe change the supported extensions to just be some predefined enums
            entity.Property(m => m.Extension).IsRequired().HasMaxLength(100);

            entity.HasOne(m => m.Post)
                .WithMany(p => p.Medias)
                .HasForeignKey(m => m.PostId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}

