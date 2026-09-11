"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AuthorDto,
  ContactChannelDto,
  ContactChannelInputDto,
  ExperienceDto,
  ExperienceInputDto,
} from "@/lib/api/generated";
import {
  authorsApi,
  contactChannelsApi,
  describeError,
  experiencesApi,
} from "./client";
import { useAuth } from "./useAuth";
import { useToast } from "./useToast";

/** The editable copy on the account. Everything else about it is the server's to decide. */
export type ProfileDraft = {
  name: string;
  email: string;
  title: string;
  headline: string;
  biography: string;
  footerBio: string;
  location: string;
  timeZoneLabel: string;
  timeZone: string;
  availability: string;
  focus: string;
  contactPitch: string;
};

/**
 * The profile tab's state: the account's copy, its avatar, its timeline and its contact
 * links.
 *
 * Only the copy is edited as a draft — it is one form with a Save. The three lists write
 * straight through, because each row is its own resource on the API and holding a dozen
 * unsaved rows behind one button would mean reconciling creates, edits and deletes on
 * submit for no gain.
 */
export function useProfile() {
  const { session } = useAuth();
  const { showToast } = useToast();

  const authorId = session?.authorId ?? null;

  const [author, setAuthor] = useState<AuthorDto | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState<null | "saving" | "avatar" | "list">(null);

  // Drops the answer to a load that a later one has already overtaken.
  const requestToken = useRef(0);

  const fail = useCallback(
    async (error: unknown, fallback: string) => {
      showToast(await describeError(error, fallback), "error");
    },
    [showToast],
  );

  /**
   * Reads the profile, its timeline and its channels in one request.
   *
   * Deliberately does not mark itself loading: `state` already starts that way, and
   * setting it here would be a synchronous state update inside the effect below. The one
   * caller that needs the marker — the retry button — sets it through `reload`.
   */
  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (authorId === null) return null;

      const token = ++requestToken.current;

      try {
        const loaded = await authorsApi.authorsGetById({ id: authorId });
        if (token !== requestToken.current) return null;

        setAuthor(loaded);
        setState("ready");

        // NOTE: the draft is only re-seeded on a full (non-silent) load. A silent reload
        // runs after a list write — adding a job, moving a link — and must not throw away
        // copy the author has typed into the form but not saved.
        if (!options?.silent) setDraft(toDraft(loaded));

        return loaded;
      } catch (error) {
        if (token !== requestToken.current) return null;
        setState("error");
        await fail(error, "Could not load your profile.");
        return null;
      }
    },
    [authorId, fail],
  );

  useEffect(() => {
    // Wrapped rather than called straight, so the first state change lands in a later
    // task: an effect body may not update state synchronously.
    void (async () => {
      await load();
    })();
  }, [load]);

  /** A load the reader asked for, which does show a spinner. */
  const reload = useCallback(async () => {
    setState("loading");
    return load();
  }, [load]);

  const isDirty = useMemo(() => {
    if (!author || !draft) return false;
    return !sameDraft(draft, toDraft(author));
  }, [author, draft]);

  const updateDraft = useCallback((patch: Partial<ProfileDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const discard = useCallback(() => {
    if (!author) return;
    setDraft(toDraft(author));
    showToast("Reverted to the last saved profile", "info");
  }, [author, showToast]);

  const save = useCallback(async () => {
    if (authorId === null || !draft) return;

    setBusy("saving");

    try {
      const saved = await authorsApi.authorsUpdate({
        id: authorId,
        updateAuthorDto: {
          name: draft.name.trim(),
          email: draft.email.trim(),
          title: blankToUndefined(draft.title),
          headline: blankToUndefined(draft.headline),
          biography: blankToUndefined(draft.biography),
          footerBio: blankToUndefined(draft.footerBio),
          location: blankToUndefined(draft.location),
          timeZoneLabel: blankToUndefined(draft.timeZoneLabel),
          timeZone: blankToUndefined(draft.timeZone),
          availability: blankToUndefined(draft.availability),
          focus: blankToUndefined(draft.focus),
          contactPitch: blankToUndefined(draft.contactPitch),
        },
      });

      setAuthor(saved);
      setDraft(toDraft(saved));
      showToast("Profile saved");
    } catch (error) {
      await fail(error, "Could not save your profile.");
    } finally {
      setBusy(null);
    }
  }, [authorId, draft, fail, showToast]);

  /* ---------------------------------------------------------------------- */
  /* Avatar                                                                 */
  /* ---------------------------------------------------------------------- */

  const uploadAvatar = useCallback(
    async (file: File) => {
      setBusy("avatar");

      try {
        const updated = await authorsApi.authorsSetAvatar({ file });
        setAuthor(updated);
        showToast("Avatar updated");
      } catch (error) {
        await fail(error, `Could not upload ${file.name}.`);
      } finally {
        setBusy(null);
      }
    },
    [fail, showToast],
  );

  const removeAvatar = useCallback(async () => {
    setBusy("avatar");

    try {
      const updated = await authorsApi.authorsRemoveAvatar();
      setAuthor(updated);
      showToast("Avatar removed", "info");
    } catch (error) {
      await fail(error, "Could not remove your avatar.");
    } finally {
      setBusy(null);
    }
  }, [fail, showToast]);

  /* ---------------------------------------------------------------------- */
  /* Experience                                                             */
  /* ---------------------------------------------------------------------- */

  const experiences = useMemo<ExperienceDto[]>(() => author?.experiences ?? [], [author]);

  const createExperience = useCallback(async (): Promise<ExperienceDto | null> => {
    setBusy("list");

    try {
      // The API needs a company, a role and a start date, so a "blank" row is seeded with
      // placeholder copy rather than being empty — it has to exist before a logo can be
      // attached to it.
      const today = new Date();
      const created = await experiencesApi.experiencesCreate({
        experienceInputDto: {
          company: "New company",
          role: "Your role there",
          startedOn: new Date(today.getFullYear(), today.getMonth(), 1),
        },
      });

      await load({ silent: true });
      showToast("Experience added");
      return created;
    } catch (error) {
      await fail(error, "Could not add that experience.");
      return null;
    } finally {
      setBusy(null);
    }
  }, [fail, load, showToast]);

  const updateExperience = useCallback(
    async (id: number, input: ExperienceInputDto) => {
      setBusy("list");

      try {
        await experiencesApi.experiencesUpdate({ id, experienceInputDto: input });
        await load({ silent: true });
        showToast("Experience saved");
      } catch (error) {
        await fail(error, "Could not save that experience.");
      } finally {
        setBusy(null);
      }
    },
    [fail, load, showToast],
  );

  const deleteExperience = useCallback(
    async (id: number) => {
      setBusy("list");

      try {
        await experiencesApi.experiencesDelete({ id });
        await load({ silent: true });
        showToast("Experience removed", "info");
      } catch (error) {
        await fail(error, "Could not remove that experience.");
      } finally {
        setBusy(null);
      }
    },
    [fail, load, showToast],
  );

  const uploadExperienceLogo = useCallback(
    async (id: number, file: File) => {
      setBusy("list");

      try {
        await experiencesApi.experiencesSetLogo({ id, file });
        await load({ silent: true });
        showToast("Logo updated");
      } catch (error) {
        await fail(error, `Could not upload ${file.name}.`);
      } finally {
        setBusy(null);
      }
    },
    [fail, load, showToast],
  );

  const removeExperienceLogo = useCallback(
    async (id: number) => {
      setBusy("list");

      try {
        await experiencesApi.experiencesRemoveLogo({ id });
        await load({ silent: true });
        showToast("Logo removed", "info");
      } catch (error) {
        await fail(error, "Could not remove that logo.");
      } finally {
        setBusy(null);
      }
    },
    [fail, load, showToast],
  );

  /* ---------------------------------------------------------------------- */
  /* Contact channels                                                       */
  /* ---------------------------------------------------------------------- */

  const channels = useMemo<ContactChannelDto[]>(() => author?.contactChannels ?? [], [author]);

  const createChannel = useCallback(
    async (input: ContactChannelInputDto) => {
      setBusy("list");

      try {
        await contactChannelsApi.contactChannelsCreate({
          contactChannelInputDto: { ...input, sortOrder: channels.length },
        });
        await load({ silent: true });
        showToast("Contact channel added");
      } catch (error) {
        await fail(error, "Could not add that contact channel.");
      } finally {
        setBusy(null);
      }
    },
    [channels.length, fail, load, showToast],
  );

  const updateChannel = useCallback(
    async (id: number, input: ContactChannelInputDto, options?: { silent?: boolean }) => {
      setBusy("list");

      try {
        await contactChannelsApi.contactChannelsUpdate({ id, contactChannelInputDto: input });
        await load({ silent: true });
        if (!options?.silent) showToast("Contact channel saved");
      } catch (error) {
        await fail(error, "Could not save that contact channel.");
      } finally {
        setBusy(null);
      }
    },
    [fail, load, showToast],
  );

  const deleteChannel = useCallback(
    async (id: number) => {
      setBusy("list");

      try {
        await contactChannelsApi.contactChannelsDelete({ id });
        await load({ silent: true });
        showToast("Contact channel removed", "info");
      } catch (error) {
        await fail(error, "Could not remove that contact channel.");
      } finally {
        setBusy(null);
      }
    },
    [fail, load, showToast],
  );

  /**
   * Swaps a link with its neighbour. Two writes rather than one reorder call: the position
   * lives on the row, and a portfolio has a handful of links, not a thousand.
   */
  const moveChannel = useCallback(
    async (id: number, direction: -1 | 1) => {
      const index = channels.findIndex((channel) => channel.id === id);
      const swapWith = channels[index + direction];

      if (index < 0 || !swapWith?.id) return;

      const moving = channels[index];
      setBusy("list");

      try {
        await Promise.all([
          contactChannelsApi.contactChannelsUpdate({
            id,
            contactChannelInputDto: { ...toChannelInput(moving), sortOrder: index + direction },
          }),
          contactChannelsApi.contactChannelsUpdate({
            id: swapWith.id,
            contactChannelInputDto: { ...toChannelInput(swapWith), sortOrder: index },
          }),
        ]);

        await load({ silent: true });
      } catch (error) {
        await fail(error, "Could not reorder your contact channels.");
      } finally {
        setBusy(null);
      }
    },
    [channels, fail, load],
  );

  return {
    author,
    draft,
    state,
    busy,
    isDirty,
    updateDraft,
    discard,
    save,
    uploadAvatar,
    removeAvatar,
    experiences,
    createExperience,
    updateExperience,
    deleteExperience,
    uploadExperienceLogo,
    removeExperienceLogo,
    channels,
    createChannel,
    updateChannel,
    deleteChannel,
    moveChannel,
    reload,
  };
}

/** The fields of an existing link, so a reorder does not have to restate them. */
export function toChannelInput(channel: ContactChannelDto): ContactChannelInputDto {
  return {
    label: channel.label ?? "",
    url: channel.url ?? "",
    handle: channel.handle ?? undefined,
    sortOrder: channel.sortOrder ?? 0,
  };
}

function toDraft(author: AuthorDto): ProfileDraft {
  return {
    name: author.name ?? "",
    email: author.email ?? "",
    title: author.title ?? "",
    headline: author.headline ?? "",
    biography: author.biography ?? "",
    footerBio: author.footerBio ?? "",
    location: author.location ?? "",
    timeZoneLabel: author.timeZoneLabel ?? "",
    timeZone: author.timeZone ?? "",
    availability: author.availability ?? "",
    focus: author.focus ?? "",
    contactPitch: author.contactPitch ?? "",
  };
}

function sameDraft(a: ProfileDraft, b: ProfileDraft): boolean {
  return (Object.keys(a) as (keyof ProfileDraft)[]).every((key) => a[key] === b[key]);
}

/** An emptied field is cleared on the server, which stores it as nothing at all. */
function blankToUndefined(value: string): string | undefined {
  return value.trim() ? value.trim() : undefined;
}
