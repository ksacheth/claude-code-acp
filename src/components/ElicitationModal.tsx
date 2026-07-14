import { useState } from "react";
import type {
  CreateElicitationRequest,
  CreateElicitationResponse,
  ElicitationContentValue,
} from "@agentclientprotocol/sdk";

export type FormElicitationRequest = CreateElicitationRequest & {
  mode: "form";
  requestedSchema: { properties?: Record<string, unknown> };
};
type FormValues = Record<string, string | string[] | number | boolean>;
type EnumOption = { const?: string; title?: string; description?: string };
type FormField = {
  type: string;
  title?: string;
  description?: string;
  oneOf?: EnumOption[];
  enum?: string[];
  items?: { anyOf?: EnumOption[] };
};

interface ElicitationModalProps {
  request: FormElicitationRequest;
  onResolve: (response: CreateElicitationResponse) => void;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function enumOption(value: unknown): EnumOption | undefined {
  const option = record(value);
  return option && typeof option.const === "string"
    ? {
        const: option.const,
        ...(typeof option.title === "string" ? { title: option.title } : {}),
        ...(typeof option.description === "string" ? { description: option.description } : {}),
      }
    : undefined;
}

function formField(value: unknown): FormField | undefined {
  const field = record(value);
  if (!field || typeof field.type !== "string") return undefined;
  const oneOf = Array.isArray(field.oneOf) ? field.oneOf.map(enumOption).filter(Boolean) : undefined;
  const items = record(field.items);
  const anyOf = Array.isArray(items?.anyOf) ? items.anyOf.map(enumOption).filter(Boolean) : undefined;
  return {
    type: field.type,
    ...(typeof field.title === "string" ? { title: field.title } : {}),
    ...(typeof field.description === "string" ? { description: field.description } : {}),
    ...(oneOf?.length ? { oneOf: oneOf as EnumOption[] } : {}),
    ...(Array.isArray(field.enum) && field.enum.every((item) => typeof item === "string")
      ? { enum: field.enum }
      : {}),
    ...(anyOf?.length ? { items: { anyOf: anyOf as EnumOption[] } } : {}),
  };
}

function formProperties(request: FormElicitationRequest): Record<string, FormField> {
  return Object.fromEntries(
    Object.entries(request.requestedSchema.properties ?? {}).flatMap(([key, value]) => {
      const field = formField(value);
      return field ? [[key, field]] : [];
    }),
  );
}

export function isFormElicitation(request: CreateElicitationRequest): request is FormElicitationRequest {
  return request.mode === "form" && !!record((request as { requestedSchema?: unknown }).requestedSchema);
}

function enumOptions(schema: FormField): EnumOption[] {
  const options =
    schema.type === "array"
      ? schema.items?.anyOf
      : schema.type === "string"
        ? schema.oneOf ?? schema.enum?.map((value) => ({ const: value, title: value }))
        : undefined;
  return options ?? [];
}

function contentFor(
  properties: Record<string, FormField>,
  values: FormValues,
): Record<string, ElicitationContentValue> {
  const content: Record<string, ElicitationContentValue> = {};
  for (const [key, schema] of Object.entries(properties)) {
      const value = values[key];
      if (schema.type === "array" && Array.isArray(value) && value.length) content[key] = value;
      else if (schema.type === "boolean" && typeof value === "boolean") content[key] = value;
      if (schema.type === "number" || schema.type === "integer") {
        if (typeof value === "number" && Number.isFinite(value)) content[key] = value;
      } else if (typeof value === "string" && value.trim()) {
        content[key] = value.trim();
      }
  }
  return content;
}

/// Renders ACP's experimental form-elicitation request. Claude's
/// AskUserQuestion tool maps to the enum and multi-select controls below.
export function ElicitationModal({ request, onResolve }: ElicitationModalProps) {
  const properties = formProperties(request);
  const [values, setValues] = useState<FormValues>({});

  const update = (key: string, value: ElicitationContentValue) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = () => onResolve({ action: "accept", content: contentFor(properties, values) });

  return (
    <div className="modal-backdrop" onClick={() => onResolve({ action: "cancel" })}>
      <section className="modal elicitation-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-title">Claude needs your input</div>
        <p className="elicitation-message">{request.message}</p>
        <div className="elicitation-fields">
          {Object.entries(properties).map(([key, schema]) => {
            const options = enumOptions(schema);
            const label = schema.title ?? schema.description ?? key;
            const value = values[key];

            return (
              <fieldset className="elicitation-field" key={key}>
                <legend>{label}</legend>
                {schema.title && schema.description && <p>{schema.description}</p>}
                {schema.type === "array" ? (
                  <div className="elicitation-options">
                    {options.map((option) => {
                      const selected = Array.isArray(value) && value.includes(option.const ?? "");
                      return (
                        <label key={option.const}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) => {
                              const current = Array.isArray(value) ? value : [];
                              const next = event.currentTarget.checked
                                ? [...current, option.const ?? ""]
                                : current.filter((item) => item !== option.const);
                              update(key, next);
                            }}
                          />
                          <span>{option.title ?? option.const}</span>
                          {option.description && <small>{option.description}</small>}
                        </label>
                      );
                    })}
                  </div>
                ) : schema.type === "string" && options.length ? (
                  <div className="elicitation-options">
                    {options.map((option) => (
                      <label key={option.const}>
                        <input
                          type="radio"
                          name={key}
                          checked={value === option.const}
                          onChange={() => update(key, option.const ?? "")}
                        />
                        <span>{option.title ?? option.const}</span>
                        {option.description && <small>{option.description}</small>}
                      </label>
                    ))}
                  </div>
                ) : schema.type === "boolean" ? (
                  <label className="elicitation-boolean">
                    <input
                      type="checkbox"
                      checked={value === true}
                      onChange={(event) => update(key, event.currentTarget.checked)}
                    />
                    Yes
                  </label>
                ) : schema.type === "number" || schema.type === "integer" ? (
                  <input
                    type="number"
                    step={schema.type === "integer" ? "1" : "any"}
                    value={typeof value === "number" ? value : ""}
                    onChange={(event) => update(key, event.currentTarget.valueAsNumber)}
                  />
                ) : (
                  <textarea
                    rows={2}
                    value={typeof value === "string" ? value : ""}
                    onChange={(event) => update(key, event.currentTarget.value)}
                  />
                )}
              </fieldset>
            );
          })}
        </div>
        <div className="modal-options">
          <button className="reject" onClick={() => onResolve({ action: "cancel" })}>Cancel</button>
          <button className="reject" onClick={() => onResolve({ action: "decline" })}>Skip</button>
          <button className="allow" onClick={submit}>Submit answers</button>
        </div>
      </section>
    </div>
  );
}
