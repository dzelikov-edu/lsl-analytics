# backend/app/logic_tournament.py

REGIONS = ["East", "Midwest", "South", "West"]

def get_snake_region_index(seed_value: int, region_count: int = 4):
    """
    Implements the Snake S-Curve:
    1 seeds: 1, 2, 3, 4  (Index: 0, 1, 2, 3)
    2 seeds: 8, 7, 6, 5  (Index: 3, 2, 1, 0)
    """
    # Determine the 'row' (e.g., 1-seeds, 2-seeds)
    row = (seed_value - 1) // region_count
    
    # Base index (0, 1, 2, or 3)
    idx = (seed_value - 1) % region_count
    
    # If the row is odd (2-seeds, 4-seeds, etc.), reverse the index
    if row % 2 == 1:
        return (region_count - 1) - idx
    return idx

def get_region_play_ins(overall_1_rank: int):
    """
    overall_1_rank: 1, 2, 3, or 4 (S-Curve rank of the #1 seed).
    9 and 12 seed play-ins go to the 3rd and 4th best #1 regions.
    """
    seeds = [10, 11, 16]
    if overall_1_rank in [3, 4]:
        seeds.extend([9, 12])
    return seeds

def check_pod_rematches(region_teams: list, seasonal_games: list):
    """
    Analyzes a region's teams and flags regular season rematches within 
    the same Round of 64 / Round of 32 pods.
    """
    warnings = []
    
    # Define Pods: (1,16,8,9), (5,12,4,13), (6,11,3,14), (7,10,2,15)
    pods = [
        [1, 16, 8, 9],
        [5, 12, 4, 13],
        [6, 11, 3, 14],
        [7, 10, 2, 15]
    ]

    for pod_seeds in pods:
        # Get the team IDs for the teams currently assigned to these seeds in this region
        pod_teams = [t for t in region_teams if t['seed'] in pod_seeds]
        
        # Compare every team in the pod against each other
        for i in range(len(pod_teams)):
            for j in range(i + 1, len(pod_teams)):
                t1 = pod_teams[i]['team_id']
                t2 = pod_teams[j]['team_id']
                
                # Check if they played in the regular season
                for game in seasonal_games:
                    if (game['team_a'] == t1 and game['team_b'] == t2) or \
                       (game['team_a'] == t2 and game['team_b'] == t1):
                        warnings.append({
                            "type": "RED_ALERT",
                            "message": f"Rematch in Pod: {t1} ({pod_teams[i]['seed']}) vs {t2} ({pod_teams[j]['seed']}) played in Week {game['week']}.",
                            "region": pod_teams[i]['region']
                        })
    return warnings
