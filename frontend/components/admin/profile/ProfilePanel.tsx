"use client";

import type { useProfile } from "@/lib/admin/useProfile";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Panel, PanelHeader } from "../ui/Panel";
import { AvatarPicker } from "./AvatarPicker";
import { ContactChannelEditor } from "./ContactChannelEditor";
import { ExperienceEditor } from "./ExperienceEditor";
import { IdentityEditor } from "./IdentityEditor";

/**
 * The third tab: everything the landing page says about the author.
 *
 * Three panels because they save three different ways — the copy is one form behind a
 * Save, while a job and a contact link are each their own row on the API and write on
 * their own.
 */
export function ProfilePanel({ profile }: { profile: ReturnType<typeof useProfile> }) {
  if (profile.state === "loading") return <ProfileSkeleton />;

  if (profile.state === "error" || !profile.draft) {
    return (
      <Panel className="p-6">
        <EmptyState
          icon="error"
          title="Could not load your profile"
          description="The API did not answer. Nothing has been changed."
          action={<Button onClick={() => void profile.reload()}>Try again</Button>}
        />
      </Panel>
    );
  }

  const locked = profile.busy !== null;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-warm-border/60 pb-2">
        <div>
          <h1 className="font-serif text-2xl font-medium text-warm-black sm:text-3xl">
            Profile & presence
          </h1>
          <p className="mt-0.5 text-[13.5px] text-warm-slate">
            Who the portfolio says you are: the copy on the landing page, your picture, your
            timeline, and how people reach you.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={profile.discard} disabled={locked || !profile.isDirty}>
            Discard
          </Button>
          <Button
            variant="primary"
            icon="save"
            onClick={() => void profile.save()}
            disabled={locked || !profile.isDirty}
            busy={profile.busy === "saving"}
          >
            Save profile
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-4">
          <Panel className="flex flex-col gap-4 p-5">
            <PanelHeader
              icon="person"
              title="Portrait"
              description="Shown on the profile card. A missing one falls back to a silhouette."
            />
            <AvatarPicker
              author={profile.author}
              busy={profile.busy === "avatar"}
              onUpload={profile.uploadAvatar}
              onRemove={profile.removeAvatar}
            />
          </Panel>
        </div>

        <div className="lg:col-span-8">
          <Panel className="flex flex-col gap-5 p-5 sm:p-6">
            <PanelHeader
              icon="edit-note"
              title="Identity & standing"
              description="Your name, what you do, where you are, and what you are open to."
            />
            <IdentityEditor
              draft={profile.draft}
              disabled={locked}
              onChange={profile.updateDraft}
            />
          </Panel>
        </div>
      </div>

      <Panel className="p-5 sm:p-6">
        <ExperienceEditor
          experiences={profile.experiences}
          busy={locked}
          onCreate={profile.createExperience}
          onUpdate={profile.updateExperience}
          onDelete={profile.deleteExperience}
          onUploadLogo={profile.uploadExperienceLogo}
          onRemoveLogo={profile.removeExperienceLogo}
        />
      </Panel>

      <Panel className="p-5 sm:p-6">
        <ContactChannelEditor
          channels={profile.channels}
          busy={locked}
          onCreate={profile.createChannel}
          onUpdate={profile.updateChannel}
          onDelete={profile.deleteChannel}
          onMove={profile.moveChannel}
        />
      </Panel>
    </section>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="h-10 w-1/3 rounded bg-warm-sunken" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="h-72 rounded bg-warm-sunken lg:col-span-4" />
        <div className="h-72 rounded bg-warm-sunken lg:col-span-8" />
      </div>
      <div className="h-40 rounded bg-warm-sunken" />
    </div>
  );
}
