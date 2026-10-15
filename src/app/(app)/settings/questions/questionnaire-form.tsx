"use client";

import { useActionState, useEffect, useId } from "react";
import { CircleCheckIcon, CircleDashedIcon, DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { FormSection } from "@/components/form-section";
import { SaveBar, useFormDirty } from "@/components/save-bar";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { QUESTIONNAIRE_LIMITS } from "@/modules/organizations/client";
import { eg } from "@/shared/text/example";
import {
  type QuestionnaireFormState,
  type QuestionnaireFormValues,
  saveQuestionnaireAction,
} from "./actions";

/** The market's worksheet wording, as plain data a browser can receive. */
export type QuestionnaireCopy = {
  title: string;
  facts: {
    code: string;
    label: string;
    hint?: string;
    options: { code: string; label: string }[];
  }[];
  questions: { code: string; text: string; context: string }[];
};

const NOTE_EXAMPLE = "Ask which documents to bring";
const ANSWER_EXAMPLE = "Yes, once the form is filed";

export function QuestionnaireForm({
  initial,
  copy,
  editable,
  pdfHref,
}: {
  initial: QuestionnaireFormValues;
  copy: QuestionnaireCopy;
  editable: boolean;
  pdfHref: string;
}) {
  const [state, formAction, pending] = useActionState<
    QuestionnaireFormState,
    FormData
  >(saveQuestionnaireAction, {});
  const { dirty, formProps } = useFormDirty(state.savedAt);
  const formId = useId();
  // React puts uncontrolled fields back to their defaults after an action, so the defaults are what was just sent.
  const values = state.values ?? initial;
  const error = (key: string) => state.errors?.[key];
  // What the page shows as answered is what was last saved, not what is being typed.
  const saved = state.savedAt && state.values ? state.values : initial;

  useEffect(() => {
    if (state.savedAt) toast.success("Worksheet saved.");
    else if (state.errors)
      toast.error("Couldn't save. Check the fields marked below.");
  }, [state.savedAt, state.errors]);

  return (
    <>
      <form
        id={formId}
        action={formAction}
        noValidate
        key={state.submittedAt ?? "initial"}
        className="grid gap-8"
        {...formProps}
      >
        <FormAlert message={error("form")} />
        <fieldset disabled={!editable} className="grid min-w-0 gap-8">
          <legend className="sr-only">{copy.title}</legend>

          <FormSection
            id="about"
            title="About your business"
            description="A few facts that change the answers you'll get. All optional."
          >
            {copy.facts.map((fact) => (
              <FormField
                key={fact.code}
                name={`fact.${fact.code}`}
                label={fact.label}
                hint={fact.hint}
                error={error(`facts.${fact.code}`)}
              >
                {(p) => (
                  <NativeSelect
                    {...p}
                    defaultValue={values.facts[fact.code] ?? ""}
                  >
                    <option value="">Not answered</option>
                    {fact.options.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            ))}
          </FormSection>

          <section
            id="questions"
            aria-labelledby="questions-heading"
            className="scroll-mt-20 rounded-xl border border-border bg-card shadow-xs"
          >
            <header className="grid gap-0.5 border-b border-border px-5 py-4 sm:px-6">
              <h2 id="questions-heading" className="font-semibold">
                Questions to ask
              </h2>
              <p className="text-sm text-pretty text-muted-foreground">
                Take these to your tax office or accountant. Write what you were
                told under each one.
              </p>
            </header>
            <ol className="divide-y divide-border">
              {copy.questions.map((question, index) => {
                const entry = values.questions[question.code];
                const answered = Boolean(
                  saved.questions[question.code]?.answer,
                );
                const key = (part: string) =>
                  `questions.${question.code}.${part}`;
                const StatusIcon = answered
                  ? CircleCheckIcon
                  : CircleDashedIcon;
                return (
                  <li key={question.code} data-question={question.code}>
                    <div
                      role="group"
                      aria-labelledby={`q-${question.code}-text`}
                      className="grid gap-4 px-5 py-5 sm:px-6"
                    >
                      <div className="grid gap-1">
                        <div className="flex items-start justify-between gap-3">
                          <p
                            id={`q-${question.code}-text`}
                            className="font-medium text-pretty"
                          >
                            <span className="mr-2 font-mono text-sm text-muted-foreground tabular-nums">
                              {index + 1}.
                            </span>
                            {question.text}
                          </p>
                          <p className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                            <StatusIcon
                              aria-hidden="true"
                              className="size-3.5"
                              strokeWidth={2}
                            />
                            {answered ? "Answered" : "Not asked yet"}
                          </p>
                        </div>
                        <p className="text-sm text-pretty text-muted-foreground">
                          {question.context}
                        </p>
                      </div>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <FormField
                          name={`q.${question.code}.note`}
                          id={`q-${question.code}-note`}
                          label="Your note"
                          optional
                          error={error(key("note"))}
                          className="sm:col-span-2"
                        >
                          {(p) => (
                            <Textarea
                              {...p}
                              defaultValue={entry?.note ?? ""}
                              maxLength={QUESTIONNAIRE_LIMITS.note}
                              placeholder={eg(NOTE_EXAMPLE)}
                            />
                          )}
                        </FormField>
                        <FormField
                          name={`q.${question.code}.answer`}
                          id={`q-${question.code}-answer`}
                          label="What you were told"
                          optional
                          error={error(key("answer"))}
                          className="sm:col-span-2"
                        >
                          {(p) => (
                            <Textarea
                              {...p}
                              defaultValue={entry?.answer ?? ""}
                              maxLength={QUESTIONNAIRE_LIMITS.answer}
                              placeholder={eg(ANSWER_EXAMPLE)}
                            />
                          )}
                        </FormField>
                        <FormField
                          name={`q.${question.code}.answeredOn`}
                          id={`q-${question.code}-answeredOn`}
                          label="Told on"
                          optional
                          error={error(key("answeredOn"))}
                        >
                          {(p) => (
                            <Input
                              {...p}
                              type="date"
                              defaultValue={entry?.answeredOn ?? ""}
                            />
                          )}
                        </FormField>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </fieldset>
      </form>
      {editable ? (
        <SaveBar
          form={formId}
          dirty={dirty}
          saved={Boolean(state.savedAt)}
          pending={pending}
        >
          <DownloadLink href={pdfHref} />
        </SaveBar>
      ) : (
        <p>
          <DownloadLink href={pdfHref} />
        </p>
      )}
    </>
  );
}

function DownloadLink({ href }: { href: string }) {
  return (
    <a href={href} download className={buttonVariants({ variant: "outline" })}>
      <DownloadIcon aria-hidden="true" />
      Download PDF
    </a>
  );
}
