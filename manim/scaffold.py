"""
Manim Community Edition — verified scaffold for ML/math explainers (dark theme).
Copy a scene, adapt, render:  manim -pql scaffold.py TemplateScene

Rules baked in (see SKILL.md): CE-only imports · construct(self) · relative positioning ·
FadeOut between stages · self.wait pacing · Text for Cyrillic (no LaTeX needed to render this file).
"""
from manim import *
import numpy as np

# --- palette / conventions (3b1b-style) ---------------------------------------
BG = "#0e0e12"
INK = "#f4f4f5"
Q_COL, K_COL, V_COL = "#ffcf5c", "#5b8cff", "#54e0a3"   # query / key / value
ACC, MUT = "#8aa0ff", "#9aa0b0"
PRIMARY, CONTEXT, STRUCTURAL = 1.0, 0.4, 0.15           # opacity tiers (fights clutter)


def dark(scene):
    scene.camera.background_color = BG


def vcol(vals, color, fs=24):
    """A labeled vector as a column of numbers inside a colored box."""
    nums = VGroup(*[Text(f"{v:.1f}", color=INK, font_size=fs) for v in vals]).arrange(DOWN, buff=0.12)
    box = SurroundingRectangle(nums, color=color, buff=0.14, stroke_width=2)
    return VGroup(box, nums)


def clear_stage(scene, run_time=0.7):
    if scene.mobjects:
        scene.play(*[FadeOut(m) for m in scene.mobjects], run_time=run_time)


class TemplateScene(Scene):
    """Title that persists + two staged beats with a fade between. The canonical layout."""
    def construct(self):
        dark(self)
        title = Text("Заголовок сцены", color=INK, weight=BOLD, font_size=40).to_edge(UP)
        self.play(Write(title))
        self.wait(0.5)

        # --- beat 1: a row of cards revealed with a stagger ---
        cards = VGroup(*[
            VGroup(RoundedRectangle(width=2.0, height=0.8, corner_radius=0.1, color=INK, stroke_width=2),
                   Text(t, color=INK, font_size=24))
            for t in ["кот", "сидел", "на", "коврике"]
        ]).arrange(RIGHT, buff=0.35).next_to(title, DOWN, buff=0.7)
        self.play(LaggedStart(*[FadeIn(c, shift=UP * 0.2) for c in cards], lag_ratio=0.15))
        self.play(cards[3][0].animate.set_stroke(Q_COL, 4).set_fill(Q_COL, 0.12),
                  cards[3][1].animate.set_color(Q_COL))
        self.play(Indicate(cards[3], color=Q_COL))
        self.wait(1)

        # --- transition to beat 2 (keep title, drop the rest) ---
        self.play(*[FadeOut(m) for m in self.mobjects if m is not title], run_time=0.7)

        # --- beat 2: hand-rolled bar chart (robust, no axes needed) ---
        weights = [0.12, 0.38, 0.16, 0.34]
        labels = ["кот", "сидел", "на", "коврике"]
        bars, nums = VGroup(), VGroup()
        base_y = -1.6
        xs = np.linspace(-3.6, 3.6, len(weights))
        for x, w, lab in zip(xs, weights, labels):
            h = max(0.08, w * 4)
            bar = Rectangle(width=0.8, height=h, color=ACC, fill_opacity=0.9, stroke_width=0)
            bar.move_to([x, base_y + h / 2, 0])
            bars.add(bar)
            nums.add(Text(f"{w:.2f}", color=ACC, font_size=24).next_to(bar, UP, buff=0.1))
            self.add(Text(lab, color=MUT, font_size=20).next_to([x, base_y, 0], DOWN, buff=0.15))
        cap = Text("веса внимания (softmax) — в сумме = 1", color=INK, font_size=24).to_edge(DOWN, buff=0.5)
        self.play(LaggedStart(*[GrowFromEdge(b, DOWN) for b in bars], lag_ratio=0.12))
        self.play(*[FadeIn(n) for n in nums], FadeIn(cap))
        self.wait(1.5)


class LiveValueDemo(Scene):
    """ValueTracker + always_redraw — the pattern for animated parameters (temperature, weight...)."""
    def construct(self):
        dark(self)
        title = Text("ValueTracker: живое значение", color=INK, font_size=34).to_edge(UP)
        self.play(Write(title))

        t = ValueTracker(0.05)
        base = [-0.5, -1.5, 0]
        bar = always_redraw(lambda: Rectangle(
            width=1.0, height=max(0.02, t.get_value() * 4), color=V_COL, fill_opacity=0.9, stroke_width=0
        ).move_to([base[0], base[1] + t.get_value() * 2, 0]))
        num = always_redraw(lambda: Text(f"вес = {t.get_value():.2f}", color=V_COL, font_size=28)
                            .next_to([2.2, 0, 0], ORIGIN))
        self.add(bar, num)
        self.play(t.animate.set_value(0.95), run_time=3, rate_func=smooth)
        self.play(t.animate.set_value(0.2), run_time=2, rate_func=smooth)
        self.wait(1)
