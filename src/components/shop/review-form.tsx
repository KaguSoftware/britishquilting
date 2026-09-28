"use client";

import { useActionState, useState } from "react";
import {IconCheck, IconStar} from "@/components/icons";
import { submitReview, type FormState } from "@/lib/actions/shop";
import { cn } from "@/lib/utils";
import { Label, btnPrimary, inputCls } from "./bits";

const WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

export function ReviewForm({ productId, slug, defaultName }: { productId: string; slug: string; defaultName: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitReview, null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const shown = hover || rating;

  if (state?.ok)
    return (
      <div className="flex items-start gap-3 border border-success/30 bg-success/5 p-6" role="status">
        <IconCheck className="mt-0.5 size-5 text-success" />
        <p>{state.message}</p>
      </div>
    );

  return (
    <form action={action} className="space-y-5 border border-stone-300 bg-cream-50 p-6 md:p-8">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="rating" value={rating || ""} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Your rating</legend>
        <div className="flex items-center gap-3">
          <div className="flex" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={rating === i}
                aria-label={`${i} star${i > 1 ? "s" : ""}, ${WORDS[i]}`}
                onClick={() => setRating(i)}
                onMouseEnter={() => setHover(i)}
                className="grid size-10 place-items-center"
              >
                <IconStar className={cn("size-6 transition-colors", i <= shown ? "fill-gold-500 text-gold-500" : "text-stone-300")} strokeWidth={1.5} />
              </button>
            ))}
          </div>
          <span className="text-sm text-ink-soft">{WORDS[shown]}</span>
        </div>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="rv-name">Display name</Label>
          <input id="rv-name" name="authorName" required maxLength={80} defaultValue={defaultName} className={inputCls} />
        </div>
        <div>
          <Label htmlFor="rv-title" hint="Optional">Headline</Label>
          <input id="rv-title" name="title" maxLength={120} placeholder="Beautiful weight, hangs well" className={inputCls} />
        </div>
      </div>
      <div>
        <Label htmlFor="rv-body">Your review</Label>
        <textarea id="rv-body" name="body" required minLength={10} maxLength={3000} rows={5} placeholder="How did it handle and hang? What did you make?" className={inputCls} />
      </div>
      {state && !state.ok && <p className="text-sm text-danger" role="alert">{state.message}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button className={btnPrimary} disabled={pending || !rating}>{pending ? "Sending..." : "Submit review"}</button>
        <p className="text-xs text-stone-500">Reviews are read by our team before they appear.</p>
      </div>
    </form>
  );
}
