/**
 * The employer's questions, and what would be filled in, before anything is.
 *
 * The rule behind this screen is the one the whole project rests on: **an answer that does
 * not point at a fact you wrote down is discarded**, and a required question left unanswered
 * skips the posting. So a row here with nothing in it is not a failure of the model — it is
 * the check working, and the fix is a fact, which you can add right here.
 *
 * An answer you type yourself is yours and needs no fact behind it, but it is still held to
 * what the form will accept: an option has to be one of the options, and a length limit is a
 * length limit. A hand-written answer the form refuses is worse than none, because it is
 * refused at the end of a filled-in application.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";

import type { ReviewDecision } from "../api";
import type { Job, ReviewQuestion } from "../types";

interface Props {
  job: Job | null;
  onDecide: (key: string, decision: ReviewDecision) => void;
}

type Value = string | string[] | null;

export function ReviewModal({ job, onDecide }: Props) {
  const questions = useMemo(() => job?.review ?? [], [job]);
  const [values, setValues] = useState<Record<string, Value>>({});
  const [facts, setFacts] = useState<Record<string, string>>({});

  useEffect(() => {
    setValues(Object.fromEntries(questions.map((one) => [one.id, one.answer])));
    setFacts({});
  }, [questions]);

  if (!job) return null;

  const unanswered = questions.filter((one) => one.required && !filled(values[one.id]));
  const typedFacts = Object.fromEntries(Object.entries(facts).filter(([, value]) => value.trim()));

  return (
    <Modal
      opened
      onClose={() => onDecide(job.key, { action: "discard" })}
      title={
        <Group gap="xs">
          <Text fw={600}>Employer questions</Text>
          <Badge variant="light">{job.title || job.key}</Badge>
        </Group>
      }
      size="lg"
      closeOnClickOutside={false}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          The form is filled in and waiting. Nothing below has been entered yet.
        </Text>

        {questions.map((question) => (
          <Field
            key={question.id}
            question={question}
            value={values[question.id] ?? null}
            onChange={(next) => setValues((current) => ({ ...current, [question.id]: next }))}
            fact={facts[question.question] ?? ""}
            onFact={(next) => setFacts((current) => ({ ...current, [question.question]: next }))}
          />
        ))}

        {questions.length === 0 && (
          <Text size="sm" c="dimmed">
            This form asks nothing.
          </Text>
        )}

        {unanswered.length > 0 && (
          <Alert color="yellow" variant="light" title="Required, and still empty">
            {unanswered.map((one) => one.question).join(" · ")} — answer them here, or add a fact and
            let the model answer them again.
          </Alert>
        )}

        <Group justify="space-between">
          <Button variant="subtle" color="red" onClick={() => onDecide(job.key, { action: "discard" })}>
            Don't apply
          </Button>
          <Group gap="xs">
            {Object.keys(typedFacts).length > 0 && (
              <Button
                variant="default"
                onClick={() => onDecide(job.key, { action: "retry", facts: typedFacts })}
              >
                Add {Object.keys(typedFacts).length} fact(s) and ask again
              </Button>
            )}
            <Button
              variant="filled"
              disabled={unanswered.length > 0}
              onClick={() => onDecide(job.key, { action: "approve", answers: values })}
            >
              Fill the form
            </Button>
          </Group>
        </Group>

        {Object.keys(typedFacts).length > 0 && (
          <Text size="xs" c="dimmed">
            Facts added here last for this session. Paste them under `candidate.facts` in your
            config to keep them.
          </Text>
        )}
      </Stack>
    </Modal>
  );
}

const filled = (value: Value) => value !== null && value !== "" && !(Array.isArray(value) && value.length === 0);

interface FieldProps {
  question: ReviewQuestion;
  value: Value;
  onChange: (value: Value) => void;
  fact: string;
  onFact: (value: string) => void;
}

function Field({ question, value, onChange, fact, onFact }: FieldProps) {
  const label = (
    <Group gap={6}>
      <Text size="sm" fw={500}>
        {question.question}
      </Text>
      {question.required && (
        <Badge size="xs" color="red" variant="outline">
          required
        </Badge>
      )}
      {question.discarded && (
        <Badge size="xs" color="yellow" variant="light" style={{ textTransform: "none" }}>
          discarded: {question.discarded}
        </Badge>
      )}
    </Group>
  );

  const control = () => {
    if (question.kind === "select" || question.kind === "radio") {
      return (
        <Select
          data={question.options}
          value={typeof value === "string" ? value : null}
          onChange={onChange}
          clearable
          searchable={question.options.length > 8}
          placeholder="No answer"
        />
      );
    }
    if (question.kind === "checkbox") {
      if (question.options.length <= 1) {
        return (
          <Checkbox
            label={question.options[0] ?? "Yes"}
            checked={String(value ?? "").toLowerCase() === "yes"}
            onChange={(event) => onChange(event.currentTarget.checked ? "Yes" : "No")}
          />
        );
      }
      return (
        <MultiSelect
          data={question.options}
          value={Array.isArray(value) ? value : value ? [value] : []}
          onChange={onChange}
          placeholder="No answer"
        />
      );
    }
    if (question.kind === "number") {
      return (
        <NumberInput
          value={typeof value === "string" && value !== "" ? Number(value) : ""}
          onChange={(next) => onChange(next === "" ? null : String(next))}
          placeholder="No answer"
        />
      );
    }
    if (question.kind === "textarea") {
      return (
        <Textarea
          autosize
          minRows={3}
          maxLength={question.maxLength ?? undefined}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder="No answer"
        />
      );
    }
    return (
      <TextInput
        maxLength={question.maxLength ?? undefined}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="No answer"
      />
    );
  };

  return (
    <Stack gap={4}>
      {label}
      {control()}
      {!filled(value) && (
        <TextInput
          size="xs"
          label="Or write down the fact that answers it"
          description="Kept for this session, and used for every posting that asks the same thing."
          value={fact}
          onChange={(event) => onFact(event.currentTarget.value)}
          placeholder="e.g. 1 month"
        />
      )}
    </Stack>
  );
}
