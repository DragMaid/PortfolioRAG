/**
 * Setting up by answering, rather than by imagining.
 *
 * Nobody can write down in advance the facts an employer will ask them for. So this does not
 * ask them to: it walks one real posting's form as far as its questions, stops there, and
 * turns what that employer wanted to know into a list to fill in — merged with the handful
 * of things nearly every board asks.
 *
 * Nothing is applied to and nothing is sent. The mock walk stops on the questions step, the
 * tab closes, and the posting is not recorded, so it is still yours to apply to properly.
 *
 * It does not finish the job, and says so. One form asks three or four things; employers keep
 * asking new ones. That is what the "when a fact is missing" setting is for — the run stops,
 * asks, and keeps what you type. Setup gets you to a working profile; the runs keep it working.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  NumberInput,
  Radio,
  Select,
  Stack,
  Stepper,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { IconArrowRight, IconSearch, IconWand } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";

import { api } from "../api";
import { PortfolioAccess } from "./PortfolioAccess";
import type { Describe, SearchDraft, SetupQuestion, SetupState } from "../types";

interface Props {
  describe: Describe;
  setup: SetupState;
  signedIn: Record<string, boolean>;
  onDone: () => void;
}

const say = (error: unknown) => String((error as Error).message ?? error);

interface Suggestion {
  board: string;
  keywords: string;
  why: string;
  evidence: string;
}

/** How much of the portfolio actually stands behind a suggestion. */
const EVIDENCE: Record<string, string> = { strong: "green", partial: "yellow", thin: "gray" };

export function SetupWizard({ describe, setup, signedIn, onDone }: Props) {
  const [step, setStep] = useState(0);
  const [url, setUrl] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resume, setResume] = useState<string | null>(null);
  const [letterNotes, setLetterNotes] = useState("");
  const [answerNotes, setAnswerNotes] = useState("");
  const [searches, setSearches] = useState<SearchDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const board = describe.boards[0] ?? "jobstreet";
  const questions = setup.questions;

  // Once the mock run comes back, move on by itself: the questions are the point of it.
  useEffect(() => {
    if (setup.found && step === 1) setStep(2);
  }, [setup.found, step]);

  const resumes = setup.found?.resumes ?? [];

  const save = async () => {
    setSaving(true);
    try {
      await api.setup.save({
        answers,
        resume: resume ? { select: resume } : undefined,
        letterNotes,
        answerNotes,
        searches: searches.length > 0 ? searches : undefined,
      });
      onDone();
    } catch (error) {
      notifications.show({ color: "red", title: "Could not save that", message: say(error) });
    } finally {
      setSaving(false);
    }
  };

  const named = (answers["name"] ?? "").trim().length > 0;

  return (
    <Box maw={840} mx="auto" p="md">
      <Stack gap="lg">
        <div>
          <Title order={3}>Set up applier</Title>
          <Text c="dimmed" size="sm">
            Four steps, and no config file to write. Nothing is applied to or sent along the way.
          </Text>
        </div>

        <Stepper active={step} onStepClick={setStep} size="sm">
          <Stepper.Step label="Sign in" description="to a job board">
            <SignIn board={board} signedIn={signedIn[board]} onNext={() => setStep(1)} />
          </Stepper.Step>

          <Stepper.Step label="Mock application" description="read a real form">
            <MockRun
              board={board}
              setup={setup}
              url={url}
              onUrl={setUrl}
              hasSearches={describe.searches.length > 0}
            />
          </Stepper.Step>

          <Stepper.Step label="Answer" description="what it found">
            <Answers
              questions={questions}
              answers={answers}
              onAnswer={(id, value) => setAnswers((current) => ({ ...current, [id]: value }))}
              found={setup.found}
              resumes={resumes}
              resume={resume}
              onResume={setResume}
              letterNotes={letterNotes}
              onLetterNotes={setLetterNotes}
              answerNotes={answerNotes}
              onAnswerNotes={setAnswerNotes}
            />
          </Stepper.Step>

          <Stepper.Step label="Searches" description="what to look for">
            <Searches
              board={board}
              searches={searches}
              onChange={setSearches}
              describe={describe}
            />
          </Stepper.Step>
        </Stepper>

        <Group justify="space-between">
          <Button variant="subtle" color="gray" onClick={() => void api.setup.skip().then(onDone)}>
            Skip setup
          </Button>
          <Group gap="xs">
            {step > 0 && (
              <Button variant="default" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button
                variant="filled"
                rightSection={<IconArrowRight size={16} />}
                onClick={() => setStep(step + 1)}
                disabled={step === 2 && !named}
              >
                {step === 2 && !named ? "Your name, at least" : "Next"}
              </Button>
            ) : (
              <Button variant="filled" loading={saving} onClick={() => void save()}>
                Finish
              </Button>
            )}
          </Group>
        </Group>
      </Stack>
    </Box>
  );
}

function SignIn({
  board,
  signedIn,
  onNext,
}: {
  board: string;
  signedIn: boolean | undefined;
  onNext: () => void;
}) {
  return (
    <Card withBorder padding="md" mt="md">
      <Stack gap="sm">
        <Text size="sm">
          The board opens in a window you can see. Sign in there once — the profile is kept, so
          this is the only time you will be asked.
        </Text>
        <Group>
          <Button variant="filled" onClick={() => void api.signIn(board)}>
            Open {board}
          </Button>
          <Button variant="default" onClick={onNext}>
            Already signed in
          </Button>
          {signedIn === true && <Badge color="green">signed in</Badge>}
          {signedIn === false && <Badge color="orange">not signed in</Badge>}
        </Group>
      </Stack>
    </Card>
  );
}

function MockRun({
  board,
  setup,
  url,
  onUrl,
  hasSearches,
}: {
  board: string;
  setup: SetupState;
  url: string;
  onUrl: (value: string) => void;
  hasSearches: boolean;
}) {
  return (
    <Card withBorder padding="md" mt="md">
      <Stack gap="sm">
        <Text size="sm">
          Paste a posting you are happy to have opened. The form is walked as far as its
          questions and abandoned there — nothing is answered, nothing is sent, and the posting
          is not recorded, so you can still apply to it properly later.
        </Text>

        <TextInput
          label="A posting to read the form from"
          placeholder="https://sg.jobstreet.com/job/12345678"
          value={url}
          onChange={(event) => onUrl(event.currentTarget.value)}
          description={
            hasSearches
              ? "Leave it empty to use the first result of your first search."
              : "Required — there are no searches yet to find one with."
          }
        />

        <Group>
          <Button
            variant="filled"
            leftSection={<IconWand size={16} />}
            loading={setup.probing}
            disabled={!url.trim() && !hasSearches}
            onClick={() =>
              api.setup
                .probe(url.trim(), board)
                .catch((error) =>
                  notifications.show({ color: "red", title: "Could not start", message: say(error) }),
                )
            }
          >
            {setup.probing ? "Reading the form…" : "Run a mock application"}
          </Button>
          {setup.probing && (
            <Text size="sm" c="dimmed">
              Watch it in the board's window.
            </Text>
          )}
        </Group>

        {setup.error && (
          <Alert color="orange" variant="light" title="It stopped">
            {setup.error}
          </Alert>
        )}

        {setup.found && (
          <Alert color="green" variant="light" title={`Found ${setup.found.questions} question(s)`}>
            {setup.found.role}
            {setup.found.company ? ` · ${setup.found.company}` : ""} — and{" "}
            {setup.found.resumes.length} resume(s) on your profile.
          </Alert>
        )}
      </Stack>
    </Card>
  );
}

function Answers({
  questions,
  answers,
  onAnswer,
  found,
  resumes,
  resume,
  onResume,
  letterNotes,
  onLetterNotes,
  answerNotes,
  onAnswerNotes,
}: {
  questions: SetupQuestion[];
  answers: Record<string, string>;
  onAnswer: (id: string, value: string) => void;
  found: SetupState["found"];
  resumes: string[];
  resume: string | null;
  onResume: (value: string | null) => void;
  letterNotes: string;
  onLetterNotes: (value: string) => void;
  answerNotes: string;
  onAnswerNotes: (value: string) => void;
}) {
  const fromPosting = questions.filter((one) => one.source === "posting");
  const baseline = questions.filter((one) => one.source === "baseline");

  return (
    <Stack gap="md" mt="md">
      <Alert color="gray" variant="light">
        Every answer becomes a fact. Employer questions are answered from these and from nothing
        else — a question your facts do not cover stops the run and asks you, rather than
        guessing. Leave anything blank that you would rather be asked about later.
      </Alert>

      {fromPosting.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={600} mb={4}>
            What {found?.company || "this employer"} asked
          </Text>
          <Text size="xs" c="dimmed" mb="sm">
            Read off their form, word for word.
          </Text>
          <Stack gap="md">
            {fromPosting.map((question) => (
              <Field key={question.id} question={question} value={answers[question.id] ?? ""} onChange={onAnswer} />
            ))}
          </Stack>
        </Card>
      )}

      <Card withBorder padding="md">
        <Text fw={600} mb={4}>
          What boards ask most
        </Text>
        <Text size="xs" c="dimmed" mb="sm">
          Not from any one posting — these just come up constantly.
        </Text>
        <Stack gap="md">
          {baseline.map((question) => (
            <Field key={question.id} question={question} value={answers[question.id] ?? ""} onChange={onAnswer} />
          ))}
        </Stack>
      </Card>

      {resumes.length > 0 && (
        <Card withBorder padding="md">
          <Radio.Group
            label="Which resume goes with an application"
            description="Read off your board profile — no filename to type."
            value={resume}
            onChange={onResume}
          >
            <Stack gap={4} mt="xs">
              {resumes.map((name) => (
                <Radio key={name} value={name} label={name} />
              ))}
            </Stack>
          </Radio.Group>
        </Card>
      )}

      <Card withBorder padding="md">
        <Stack gap="sm">
          <Textarea
            label="Notes for the cover letter"
            description="Steers its wording. Not a fact, and grants nothing."
            placeholder="Lead with the retrieval work. Don't over-claim the ML — it was applied, not research."
            autosize
            minRows={2}
            value={letterNotes}
            onChange={(event) => onLetterNotes(event.currentTarget.value)}
          />
          <Textarea
            label="Notes for employer questions"
            description="Which option to take where two fit, how to phrase a number. Also not a fact: an answer still has to point at one."
            placeholder="When two options both fit, take the conservative one. Never give a salary range."
            autosize
            minRows={2}
            value={answerNotes}
            onChange={(event) => onAnswerNotes(event.currentTarget.value)}
          />
        </Stack>
      </Card>
    </Stack>
  );
}

function Field({
  question,
  value,
  onChange,
}: {
  question: SetupQuestion;
  value: string;
  onChange: (id: string, value: string) => void;
}) {
  const label = (
    <Group gap={6}>
      <Text size="sm" fw={500}>
        {question.question}
      </Text>
      {question.source === "posting" && (
        <Badge size="xs" variant="outline">
          asked
        </Badge>
      )}
    </Group>
  );

  const description = question.target === "fact" ? `Kept as “${question.factKey}”` : undefined;

  if (question.options.length > 0) {
    return (
      <Select
        label={label}
        description={description}
        placeholder={question.hint ?? "Leave blank to be asked later"}
        data={question.options}
        value={value || null}
        clearable
        onChange={(next) => onChange(question.id, next ?? "")}
      />
    );
  }

  if (question.kind === "number") {
    return (
      <NumberInput
        label={label}
        description={description}
        placeholder={question.hint ?? "Leave blank to be asked later"}
        value={value === "" ? "" : Number(value)}
        onChange={(next) => onChange(question.id, next === "" ? "" : String(next))}
      />
    );
  }

  return (
    <TextInput
      label={label}
      description={description}
      placeholder={question.hint ?? "Leave blank to be asked later"}
      value={value}
      onChange={(event) => onChange(question.id, event.currentTarget.value)}
    />
  );
}

function Searches({
  board,
  searches,
  onChange,
  describe,
}: {
  board: string;
  searches: SearchDraft[];
  onChange: (next: SearchDraft[]) => void;
  describe: Describe;
}) {
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("");
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<{ title: string; company: string | null }[] | null>(null);
  const [looking, setLooking] = useState(false);
  const [suggested, setSuggested] = useState<Suggestion[] | null>(null);
  const [thinking, setThinking] = useState(false);

  const draft: SearchDraft = useMemo(
    () =>
      url.trim()
        ? { board, keywords: "", url: url.trim() }
        : { board, keywords: keywords.trim(), location: location.trim() || null },
    [board, keywords, location, url],
  );

  const usable = Boolean(url.trim() || keywords.trim());

  const look = async () => {
    setLooking(true);
    try {
      const { listings } = await api.setup.preview(draft);
      setPreview(listings.map((one) => ({ title: one.title, company: one.company })));
    } catch (error) {
      notifications.show({ color: "red", title: "That search found nothing", message: say(error) });
      setPreview(null);
    } finally {
      setLooking(false);
    }
  };

  const suggest = async () => {
    setThinking(true);
    try {
      const { searches: found } = await api.setup.suggest();
      setSuggested(found);
    } catch (error) {
      notifications.show({
        color: "orange",
        title: "Could not read your portfolio",
        message: say(error),
      });
    } finally {
      setThinking(false);
    }
  };

  return (
    <Stack gap="md" mt="md">
      {/* Nothing before this step needed the portfolio; from here on everything does. */}
      <PortfolioAccess describe={describe} onSaved={() => void api.describe()} />

      <Card withBorder padding="md">
        <Group justify="space-between" mb={suggested ? "sm" : 0}>
          <div>
            <Text fw={600} size="sm">
              Suggest searches from my portfolio
            </Text>
            <Text size="xs" c="dimmed">
              The same retrieval that measures a posting against your work, pointed the other
              way. Needs the portfolio API, the rag worker and a model — skip it if they are
              not running.
            </Text>
          </div>
          <Button size="xs" variant="default" loading={thinking} onClick={() => void suggest()}>
            Suggest
          </Button>
        </Group>

        {suggested && (
          <Stack gap={4}>
            {suggested.length === 0 && (
              <Text size="sm" c="dimmed">
                Nothing it was confident enough to name.
              </Text>
            )}
            {suggested.map((one) => (
              <Group key={one.keywords} justify="space-between" wrap="nowrap">
                <Group gap={8} wrap="nowrap">
                  <Badge size="xs" color={EVIDENCE[one.evidence] ?? "gray"}>
                    {one.evidence}
                  </Badge>
                  <Text size="sm">{one.keywords}</Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {one.why}
                  </Text>
                </Group>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  onClick={() =>
                    onChange([...searches, { board, keywords: one.keywords, enabled: true }])
                  }
                >
                  Add
                </Button>
              </Group>
            ))}
          </Stack>
        )}
      </Card>

      <Card withBorder padding="md">
        <Stack gap="sm">
          <Group grow align="flex-end">
            <TextInput
              label="Keywords"
              placeholder="backend engineer"
              value={keywords}
              onChange={(event) => setKeywords(event.currentTarget.value)}
              disabled={Boolean(url.trim())}
            />
            <TextInput
              label="Location"
              placeholder="Singapore"
              value={location}
              onChange={(event) => setLocation(event.currentTarget.value)}
              disabled={Boolean(url.trim())}
            />
          </Group>

          <TextInput
            label="Or a search URL from the board itself"
            description="Refine it there with their own filters and paste it here; it is used exactly as given."
            placeholder="https://sg.jobstreet.com/python-jobs/full-time?daterange=3"
            value={url}
            onChange={(event) => setUrl(event.currentTarget.value)}
          />

          <Group>
            <Button
              variant="default"
              leftSection={<IconSearch size={16} />}
              loading={looking}
              disabled={!usable}
              onClick={() => void look()}
            >
              Preview
            </Button>
            <Button
              variant="filled"
              disabled={!usable}
              onClick={() => {
                onChange([...searches, draft]);
                setKeywords("");
                setLocation("");
                setUrl("");
                setPreview(null);
              }}
            >
              Add it
            </Button>
          </Group>

          {preview && (
            <Alert color={preview.length > 0 ? "gray" : "orange"} variant="light">
              {preview.length === 0
                ? "Nothing on the first page. Try different keywords."
                : `${preview.length} on the first page — ${preview
                    .slice(0, 3)
                    .map((one) => one.title)
                    .join(", ")}…`}
            </Alert>
          )}
        </Stack>
      </Card>

      {searches.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={600} mb="xs">
            Searches to run
          </Text>
          <Stack gap={4}>
            {searches.map((search, index) => (
              <Group key={index} justify="space-between">
                <Text size="sm">
                  {search.keywords || search.url}
                  {search.location ? ` · ${search.location}` : ""}
                </Text>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="red"
                  onClick={() => onChange(searches.filter((_, at) => at !== index))}
                >
                  Remove
                </Button>
              </Group>
            ))}
          </Stack>
        </Card>
      )}

      <Text size="xs" c="dimmed">
        You can add more later, and everything here is written to your config file.
      </Text>
    </Stack>
  );
}
