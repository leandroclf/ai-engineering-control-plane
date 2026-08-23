"use client";

import { useEffect, useState } from "react";

export function TutorialCheckpoint({ moduleId, question, options, answer }: { moduleId: string; question: string; options: string[]; answer: string }) {
  const [selected, setSelected] = useState("");
  const [complete, setComplete] = useState(false);
  useEffect(() => setComplete(window.localStorage.getItem(`aicp:academy:${moduleId}`) === "complete"), [moduleId]);
  const submit = () => { if (selected === answer) { window.localStorage.setItem(`aicp:academy:${moduleId}`, "complete"); setComplete(true); } };
  return <div data-tutorial-target="checkpoint"><p>{question}</p><fieldset><legend className="sr-only">Choose the correct answer</legend>{options.map((option) => <label key={option}><input type="radio" name={moduleId} value={option} checked={selected === option} onChange={() => setSelected(option)} /> {option}</label>)}</fieldset>{complete ? <p className="notice" role="status">Checkpoint completed. Progress is stored locally on this device.</p> : <button className="button button-primary" type="button" onClick={submit} disabled={!selected}>Complete checkpoint</button>}{selected && !complete && selected !== answer ? <p className="muted" role="status">Not quite. Revisit the lesson and try again.</p> : null}</div>;
}
