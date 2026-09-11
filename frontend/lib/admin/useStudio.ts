"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MediaDto, PostDto, PostSummaryDto } from "@/lib/api/generated";
import { MediaRole, PostSortOrder } from "@/lib/api/generated";
import { adminPostsApi, describeError, postMediaApi } from "./client";
import { useToast } from "./useToast";

/** The registry's filter tabs. Counts come from the loaded list, not from three more queries. */
export type RegistryFilter = "all" | "live" | "draft";

/** The editable shape of a post. Everything else about it is the server's to decide. */
export type Draft = {
  title: string;
  slug: string;
  summary: string;
  body: string;
  isFeatured: boolean;
  /** The kicker beside the ordinal on the card — "VECTOR CORE". */
  category: string;
  /** The line in the card footer — "Vector Storage". */
  domain: string;
  repoUrl: string;
  demoUrl: string;
  specUrl: string;
};

/** How many posts the registry loads. Well past what one portfolio holds. */
const PAGE_SIZE = 100;

export function useStudio() {
  const { showToast } = useToast();

  const [posts, setPosts] = useState<PostSummaryDto[]>([]);
  const [filter, setFilter] = useState<RegistryFilter>("all");
  const [activeId, setActiveId] = useState<number | null>(null);

  /** The post as the server last gave it to us. Discard reverts to this; dirty compares against it. */
  const [baseline, setBaseline] = useState<PostDto | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [media, setMedia] = useState<MediaDto[]>([]);

  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading");
  const [editorState, setEditorState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [busy, setBusy] = useState<null | "saving" | "publishing" | "creating">(null);

  // useRef return the same object everytime and doesn't trigger re-render
  const requestToken = useRef(0);

  const fail = useCallback(
    async (error: unknown, fallback: string) => {
      showToast(await describeError(error, fallback), "error");
    },
    [showToast],
  );

  const loadPosts = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) setListState("loading");

      try {
        const result = await adminPostsApi.adminPostsGetAll({
          sort: PostSortOrder.Newest,
          pageSize: PAGE_SIZE,
        });

        setPosts(result.items ?? []);
        setListState("ready");
        return result.items ?? [];
      } catch (error) {
        setListState("error");
        await fail(error, "Could not load the project registry.");
        return [];
      }
    },
    [fail],
  );

  const openPost = useCallback(
    async (id: number) => {
      const token = ++requestToken.current;

      setActiveId(id);
      setEditorState("loading");
      setBaseline(null);
      setDraft(null);
      setMedia([]);

      try {
        const post = await adminPostsApi.adminPostsGetById({ id });
        if (token !== requestToken.current) return;

        setBaseline(post);
        setDraft(toDraft(post));
        setEditorState("ready");

        // NOTE: after the post, and not awaited alongside it. A media list that fails —
        // storage unconfigured answers 503 — must not take the editor down with it.
        try {
          const items = await postMediaApi.postMediaGetAll({ postId: id });
          if (token === requestToken.current) setMedia(items);
        } catch {
          if (token === requestToken.current) setMedia([]);
        }
      } catch (error) {
        if (token !== requestToken.current) return;
        setEditorState("error");
        await fail(error, "Could not open that project.");
      }
    },
    [fail],
  );

  // First load: fetch the registry and open whatever is at the top of it.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const items = await loadPosts();
      if (cancelled) return;

      const first = items[0]?.id;
      if (first !== undefined) void openPost(first);
      else setEditorState("idle");
    })();

    return () => {
      cancelled = true;
    };
  }, [loadPosts, openPost]);

  const isDirty = useMemo(() => {
    if (!baseline || !draft) return false;
    return !sameDraft(draft, toDraft(baseline));
  }, [baseline, draft]);

  const updateDraft = useCallback((patch: Partial<Draft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const discard = useCallback(() => {
    if (!baseline) return;

    setDraft(toDraft(baseline));
    showToast("Reverted to the last saved version", "info");
  }, [baseline, showToast]);

  /**
   * Writes the draft. Returns the saved post, or null if it failed — the publish flow needs
   * to know, because publishing edits that were never written would put the old body live.
   */
  const save = useCallback(
    async (options?: { silent?: boolean }): Promise<PostDto | null> => {
      if (!baseline?.id || !draft) return null;

      setBusy("saving");

      try {
        const saved = await adminPostsApi.adminPostsUpdate({
          id: baseline.id,
          updatePostDto: {
            title: draft.title.trim(),
            slug: draft.slug.trim() === (baseline.slug ?? "") ? undefined : draft.slug.trim() || undefined,
            summary: draft.summary.trim() || undefined,
            body: draft.body,
            isFeatured: draft.isFeatured,
            category: draft.category.trim() || undefined,
            domain: draft.domain.trim() || undefined,
            repoUrl: draft.repoUrl.trim() || undefined,
            demoUrl: draft.demoUrl.trim() || undefined,
            specUrl: draft.specUrl.trim() || undefined,
          },
        });

        setBaseline(saved);
        setDraft(toDraft(saved));
        await loadPosts({ silent: true });

        if (!options?.silent) showToast("Saved");
        return saved;
      } catch (error) {
        await fail(error, "Could not save this project.");
        return null;
      } finally {
        setBusy(null);
      }
    },
    [baseline, draft, fail, loadPosts, showToast],
  );

  /** Saves anything outstanding, then publishes. The prototype's one green-light action. */
  const publish = useCallback(async () => {
    if (!baseline?.id) return;

    if (isDirty) {
      const saved = await save({ silent: true });
      if (!saved) return;
    }

    setBusy("publishing");

    try {
      const published = await adminPostsApi.adminPostsPublish({ id: baseline.id });

      setBaseline(published);
      setDraft(toDraft(published));
      await loadPosts({ silent: true });
      showToast("Published — the post is live");
    } catch (error) {
      await fail(error, "Could not publish this project.");
    } finally {
      setBusy(null);
    }
  }, [baseline, isDirty, save, loadPosts, showToast, fail]);

  const unpublish = useCallback(async () => {
    if (!baseline?.id) return;

    setBusy("publishing");

    try {
      const post = await adminPostsApi.adminPostsUnpublish({ id: baseline.id });

      setBaseline(post);
      setDraft(toDraft(post));
      await loadPosts({ silent: true });
      showToast("Unpublished — back to draft", "info");
    } catch (error) {
      await fail(error, "Could not unpublish this project.");
    } finally {
      setBusy(null);
    }
  }, [baseline, loadPosts, showToast, fail]);

  const createPost = useCallback(async () => {
    setBusy("creating");

    try {
      // NOTE: the API needs a title and a body up front, so a "blank" entry is seeded with
      // placeholder copy rather than being empty. The prototype only reset the form; here
      // the row has to exist before media can be attached to it.
      const created = await adminPostsApi.adminPostsCreate({
        createPostDto: {
          title: "Untitled project",
          summary: "A one-line pitch for this project.",
          body: "# Untitled project\n\nStart writing.\n",
        },
      });

      await loadPosts({ silent: true });
      if (created.id !== undefined) await openPost(created.id);

      showToast("New draft created");
    } catch (error) {
      await fail(error, "Could not create a new project.");
    } finally {
      setBusy(null);
    }
  }, [loadPosts, openPost, showToast, fail]);

  const deletePost = useCallback(async () => {
    if (!baseline?.id) return;

    setBusy("saving");

    try {
      await adminPostsApi.adminPostsDelete({ id: baseline.id });

      const remaining = await loadPosts({ silent: true });
      showToast("Project deleted", "info");

      const next = remaining[0]?.id;
      if (next !== undefined) {
        await openPost(next);
      } else {
        setActiveId(null);
        setBaseline(null);
        setDraft(null);
        setMedia([]);
        setEditorState("idle");
      }
    } catch (error) {
      await fail(error, "Could not delete this project.");
    } finally {
      setBusy(null);
    }
  }, [baseline, loadPosts, openPost, showToast, fail]);

  const uploadMedia = useCallback(
    async (files: FileList | File[], role: MediaRole = MediaRole.Attachment) => {
      if (!baseline?.id) return;

      const list = Array.from(files);
      if (list.length === 0) return;

      // A post holds one thumbnail and one trailer, so only the first file counts for
      // those — uploading three in turn would just be two wasted round trips, each one
      // replacing the last.
      const selected = role === MediaRole.Attachment ? list : list.slice(0, 1);

      // NOTE: one at a time. The endpoint takes a single file, and firing ten parallel
      // multipart uploads at a re-encoding backend is how a browser tab stops responding.
      let uploaded = 0;

      for (const file of selected) {
        try {
          await postMediaApi.postMediaUpload({ postId: baseline.id, file, role });
          uploaded++;
        } catch (error) {
          await fail(error, `Could not upload ${file.name}.`);
        }
      }

      try {
        setMedia(await postMediaApi.postMediaGetAll({ postId: baseline.id }));
      } catch {
        // The uploads landed even if the re-read did not; the next open will show them.
      }

      if (uploaded > 0) {
        showToast(
          role === MediaRole.Attachment
            ? `Uploaded ${uploaded} file${uploaded === 1 ? "" : "s"}`
            : `${role === MediaRole.Thumbnail ? "Thumbnail" : "Trailer"} set`,
        );
      }
    },
    [baseline, fail, showToast],
  );

  const updateMediaCaption = useCallback(
    async (mediaId: number, caption: string) => {
      if (!baseline?.id) return;

      try {
        const updated = await postMediaApi.postMediaUpdate({
          postId: baseline.id,
          mediaId,
          updateMediaDto: { caption: caption.trim() || undefined },
        });

        setMedia((current) => current.map((item) => (item.id === mediaId ? updated : item)));
        showToast("Caption saved");
      } catch (error) {
        await fail(error, "Could not save that caption.");
      }
    },
    [baseline, fail, showToast],
  );

  const deleteMedia = useCallback(
    async (mediaId: number) => {
      if (!baseline?.id) return;

      try {
        await postMediaApi.postMediaDelete({ postId: baseline.id, mediaId });

        setMedia((current) => current.filter((item) => item.id !== mediaId));
        showToast("Asset removed", "info");
      } catch (error) {
        await fail(error, "Could not remove that asset.");
      }
    },
    [baseline, fail, showToast],
  );

  const thumbnail = useMemo(
    () => media.find((item) => item.role === MediaRole.Thumbnail) ?? null,
    [media],
  );

  const trailer = useMemo(
    () => media.find((item) => item.role === MediaRole.Trailer) ?? null,
    [media],
  );

  /** Ordinary files the body embeds — the two leading slots are shown on their own. */
  const attachments = useMemo(
    () => media.filter((item) => item.role === MediaRole.Attachment),
    [media],
  );

  /**
   * Why Publish is unavailable, in the order the author should fix them.
   *
   * The API refuses to publish a project with no thumbnail or no trailer, so the button is
   * disabled with the reason spelled out rather than left to be clicked for an error toast.
   * The check is duplicated here on purpose: the server's copy is the one that decides, and
   * this one exists only so the studio does not have to ask in order to know.
   */
  const publishBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (!thumbnail) blockers.push("a thumbnail");
    if (!trailer) blockers.push("a trailer");
    return blockers;
  }, [thumbnail, trailer]);

  const counts = useMemo(
    () => ({
      all: posts.length,
      live: posts.filter((post) => !post.isDraft).length,
      draft: posts.filter((post) => post.isDraft).length,
    }),
    [posts],
  );

  const visiblePosts = useMemo(() => {
    if (filter === "live") return posts.filter((post) => !post.isDraft);
    if (filter === "draft") return posts.filter((post) => post.isDraft);
    return posts;
  }, [posts, filter]);

  return {
    posts,
    visiblePosts,
    counts,
    filter,
    setFilter,
    activeId,
    openPost,
    baseline,
    draft,
    updateDraft,
    isDirty,
    media,
    thumbnail,
    trailer,
    attachments,
    publishBlockers,
    listState,
    editorState,
    busy,
    save,
    publish,
    unpublish,
    discard,
    createPost,
    deletePost,
    uploadMedia,
    updateMediaCaption,
    deleteMedia,
    reloadPosts: loadPosts,
  };
}

function toDraft(post: PostDto): Draft {
  return {
    title: post.title ?? "",
    slug: post.slug ?? "",
    summary: post.summary ?? "",
    body: post.body ?? "",
    isFeatured: post.isFeatured ?? false,
    category: post.category ?? "",
    domain: post.domain ?? "",
    repoUrl: post.repoUrl ?? "",
    demoUrl: post.demoUrl ?? "",
    specUrl: post.specUrl ?? "",
  };
}

function sameDraft(a: Draft, b: Draft): boolean {
  // Compares every field rather than a hand-written list, so a field added to Draft is
  // covered here without anyone remembering to come back and add it.
  return (Object.keys(a) as (keyof Draft)[]).every((key) => a[key] === b[key]);
}
