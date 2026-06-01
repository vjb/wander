"""
Test: Steps and kcal calculation accuracy

Checks that the step count derived from route_steps.distance_m matches
expected real-world values for known routes.
"""

# ── Constants ──────────────────────────────────────────────────────────────────
STRIDE_M = 0.762          # average stride length (m)
KCAL_PER_M = 0.057        # MET 3.5 walking, 70 kg person

def calc_steps(route_steps: list) -> int:
    """Sum distance_m across all steps, divide by stride length."""
    total_m = sum(s.get("distance_m", 0) for s in route_steps)
    return round(total_m / STRIDE_M)

def calc_kcal(route_steps: list) -> int:
    total_m = sum(s.get("distance_m", 0) for s in route_steps)
    return round(total_m * KCAL_PER_M)

# ── Test data (from actual route shown in app) ─────────────────────────────────
# Route: 515 W 52nd St → Clinton Community Garden → Oasis Garden → 515 W 52nd St
# Turn-by-turn as shown in the UI:
SAMPLE_STEPS = [
    {"instruction": "Head southeast on W 52nd St toward 10th Ave", "distance_m": 89,  "duration_secs": 64},
    {"instruction": "Turn right onto 10th Ave",                    "distance_m": 319, "duration_secs": 229},
    {"instruction": "Turn left onto W 48th St",                    "distance_m": 103, "duration_secs": 74},
    {"instruction": "Head northwest on W 48th St toward 10th Ave", "distance_m": 103, "duration_secs": 74},
    {"instruction": "Turn right onto 10th Ave",                    "distance_m": 319, "duration_secs": 229},
    {"instruction": "Turn left onto W 52nd St",                    "distance_m": 42,  "duration_secs": 35},
    {"instruction": "Head northwest on W 52nd St",                 "distance_m": 47,  "duration_secs": 36},
]

total_m = sum(s["distance_m"] for s in SAMPLE_STEPS)
walking_mins = round(sum(s["duration_secs"] for s in SAMPLE_STEPS) / 60)

steps_distance_based = calc_steps(SAMPLE_STEPS)
steps_time_based_old = round(walking_mins * 120)   # old broken formula
steps_time_based_good = round(walking_mins * 100)  # better time fallback

kcal_distance_based = calc_kcal(SAMPLE_STEPS)
kcal_time_based_old = round(walking_mins * 4.5)

print("=" * 60)
print("ROUTE METRICS TEST")
print("=" * 60)
print(f"Total distance:         {total_m:,} m  ({total_m/1000:.2f} km)")
print(f"Total walking time:     {walking_mins} min")
print()
print(f"STEPS (old formula — time × 120):  {steps_time_based_old:,}  ← WRONG")
print(f"STEPS (new formula — dist/0.762):  {steps_distance_based:,}  ← CORRECT")
print()

# Sanity check: a reasonable step range for ~1km walk
assert 1000 <= steps_distance_based <= 1800, f"Steps out of range: {steps_distance_based}"
# Check new formula is less than old (old was inflated)
assert steps_distance_based < steps_time_based_old, "New formula should give fewer steps than old"
# Check ~2000 steps/mile (~1243 steps/km)
expected_approx = round(total_m / 1000 * 1312)  # 1312 steps/km = typical
tolerance = 0.25  # allow 25% variance
assert abs(steps_distance_based - expected_approx) / expected_approx < tolerance, \
    f"Steps too far from expected: got {steps_distance_based}, expected ~{expected_approx}"

print(f"KCAL (old formula — time × 4.5):   {kcal_time_based_old} kcal  ← less accurate")
print(f"KCAL (new formula — dist × 0.057): {kcal_distance_based} kcal  ← MET-based")
print()

# Sanity: ~50-80 kcal per km is reasonable for walking
kcal_per_km = kcal_distance_based / (total_m / 1000)
assert 40 <= kcal_per_km <= 100, f"kcal/km out of range: {kcal_per_km:.1f}"

print("✅ All assertions passed!")
print()
print("VALIDATION REFERENCE TABLE (distance → expected steps)")
print("-" * 50)
test_distances = [500, 750, 1000, 1500, 2000, 3000, 5000]
for d in test_distances:
    steps = round(d / STRIDE_M)
    kcal  = round(d * KCAL_PER_M)
    old   = round((d / 1.4 / 60) * 120)  # old: distance→time→steps (1.4m/s walk)
    print(f"  {d:5,}m → {steps:4,} steps  {kcal:3} kcal  (old formula would give {old:4,})")
