#!/usr/bin/env python3
import json,time,urllib.request
from datetime import datetime,timezone
from pathlib import Path
from collections import Counter
LEAGUE_ID=1112007
BASE="https://fantasy.premierleague.com/api"
OUT=Path(__file__).resolve().parents[1]/"data"/"fpl-data.json"
UA="Mozilla/5.0 (compatible; VirtuosoFPLDashboard/2.0; GitHubPages)"
def get_json(path,retries=3):
    url=path if path.startswith("http") else f"{BASE}{path}"
    req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept":"application/json"})
    last=None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req,timeout=25) as r:return json.load(r)
        except Exception as e:
            last=e
            if attempt<retries-1:time.sleep(1.5*(attempt+1))
    raise RuntimeError(f"Failed GET {url}: {last}")
def current_gameweek(b):
    events=b.get("events",[]);cur=next((e for e in events if e.get("is_current")),None)
    if cur:return cur
    nxt=next((e for e in events if e.get("is_next")),None)
    if nxt:return nxt
    fin=[e for e in events if e.get("finished")]
    return fin[-1] if fin else (events[0] if events else {"id":1,"name":"Gameweek 1"})
def league_rows():
    page,rows,league=1,[],{}
    while True:
        d=get_json(f"/leagues-classic/{LEAGUE_ID}/standings/?page_standings={page}")
        if not league:league=d.get("league",{})
        block=d.get("standings",{});rows.extend(block.get("results",[]))
        if not block.get("has_next"):break
        page+=1
        if page>50:break
    return league,rows
def safe_json(path):
    try:return get_json(path)
    except Exception as e:print(f"Warning: {path}: {e}");return {}
def chip_for_current(history,picks,gw):
    if picks.get("active_chip"):return picks.get("active_chip")
    for c in history.get("chips",[]):
        if c.get("event")==gw:return c.get("name")
    return None
def pname(p):return p.get("web_name") or f"{p.get('first_name','')} {p.get('second_name','')}".strip()
def main():
    bootstrap=get_json("/bootstrap-static/");gw_obj=current_gameweek(bootstrap);gw=int(gw_obj.get("id") or 1);league,standings=league_rows();players={p["id"]:p for p in bootstrap.get("elements",[])};teams={t["id"]:t.get("short_name") or t.get("name") for t in bootstrap.get("teams",[])}
    manager_data={};ownership=Counter();captains=Counter()
    for i,row in enumerate(standings,start=1):
        entry=row["entry"];history=safe_json(f"/entry/{entry}/history/");picks=safe_json(f"/entry/{entry}/event/{gw}/picks/") if gw else {};manager_data[entry]={"history":history,"picks":picks}
        for pick in picks.get("picks",[]):
            ownership[pick.get("element")]+=1
            if pick.get("is_captain"):captains[pick.get("element")]+=1
        if i<len(standings):time.sleep(.08)
    table=[]
    for row in standings:
        entry=row["entry"];hist=manager_data[entry]["history"];picks=manager_data[entry]["picks"];rank=int(row.get("rank") or 0);last_rank=int(row.get("last_rank") or rank)
        table.append({"entry":entry,"rank":rank,"last_rank":last_rank,"movement":last_rank-rank,"team":row.get("entry_name","") ,"manager":row.get("player_name","") ,"gw_points":int(row.get("event_total") or 0),"total":int(row.get("total") or 0),"active_chip":chip_for_current(hist,picks,gw)})
    mc=len(table);leader=min(table,key=lambda x:x["rank"]) if table else {};gwk=max(table,key=lambda x:x["gw_points"]) if table else {};bad=min(table,key=lambda x:x["gw_points"]) if table else {};climber=max(table,key=lambda x:x["movement"]) if table else {};faller=min(table,key=lambda x:x["movement"]) if table else {}
    all_events=sorted({h.get("event") for md in manager_data.values() for h in md["history"].get("current",[]) if h.get("event")});last6=all_events[-6:];last4=all_events[-4:];hmap={}
    for entry,md in manager_data.items():hmap[entry]={h["event"]:h for h in md["history"].get("current",[]) if h.get("event")}
    month=[]
    for row in table:month.append((sum(int(hmap[row["entry"]].get(e,{}).get("points") or 0) for e in last4),row))
    motm_points,motm=max(month,default=(0,{}),key=lambda x:x[0]);rank_by_gw={}
    for e in last6:
        totals=[]
        for row in table:
            h=hmap[row["entry"]].get(e)
            if h:totals.append((int(h.get("total_points") or 0),row["entry"]))
        totals.sort(reverse=True);rank_by_gw[e]={entry:i+1 for i,(_,entry) in enumerate(totals)}
    top6=sorted(table,key=lambda x:x["rank"])[:6];performance=[];positions=[]
    for row in top6:
        performance.append({"name":row["team"],"values":[hmap[row["entry"]].get(e,{}).get("points") for e in last6]});positions.append({"name":row["team"],"values":[rank_by_gw.get(e,{}).get(row["entry"]) for e in last6]})
    winners=[]
    for e in reversed(all_events[-4:]):
        cand=[]
        for row in table:
            h=hmap[row["entry"]].get(e)
            if h:cand.append((int(h.get("points") or 0),row))
        if cand:
            pts,w=max(cand,key=lambda x:x[0]);winners.append({"gameweek":e,"points":pts,"team":w["team"],"manager":w["manager"]})
    def pinfo(pid):
        p=players.get(pid,{})
        return {"id":pid,"name":pname(p),"team":teams.get(p.get("team"),""),"points":int(p.get("event_points") or 0)}
    cap_items=captains.most_common();cap_pop=[]
    for pid,count in cap_items[:4]:
        x=pinfo(pid);x.update(count=count,percent=count*100/mc if mc else 0);cap_pop.append(x)
    if cap_items:
        pid,count=cap_items[0];most_cap=pinfo(pid);most_cap.update(count=count,percent=count*100/mc if mc else 0)
    else:most_cap={}
    own_items=ownership.most_common()
    if own_items:
        pid,count=own_items[0];most_owned=pinfo(pid);most_owned.update(count=count,percent=count*100/mc if mc else 0)
    else:most_owned={}
    diffs=[]
    for pid,count in ownership.items():
        op=count*100/mc if mc else 0
        if count and op<=25:
            x=pinfo(pid);x.update(count=count,percent=op);diffs.append(x)
    top_diff=max(diffs,default={},key=lambda x:(x.get("points",0),-x.get("percent",100)));highest=max((pinfo(pid) for pid in players),default={},key=lambda x:x.get("points",0))
    payload={"generated_at":datetime.now(timezone.utc).isoformat(),"league":{"id":LEAGUE_ID,"name":league.get("name") or "Virtuoso FPL"},"gameweek":{"id":gw,"name":gw_obj.get("name"),"finished":bool(gw_obj.get("finished"))},"summary":{"manager_count":mc,"average_gw":round(sum(x["gw_points"] for x in table)/mc,1) if mc else 0,"leader":{"team":leader.get("team"),"manager":leader.get("manager"),"total":leader.get("total")},"gw_king":{"team":gwk.get("team"),"manager":gwk.get("manager"),"gw_points":gwk.get("gw_points")},"bad_week":{"team":bad.get("team"),"manager":bad.get("manager"),"gw_points":bad.get("gw_points")},"biggest_climber":{"team":climber.get("team"),"manager":climber.get("manager"),"movement":climber.get("movement",0)},"biggest_faller":{"team":faller.get("team"),"manager":faller.get("manager"),"movement":faller.get("movement",0)},"manager_of_month":{"team":motm.get("team"),"manager":motm.get("manager"),"points":motm_points,"gameweeks":len(last4)}},"standings":sorted(table,key=lambda x:x["rank"]),"players":{"most_captained":most_cap,"most_owned":most_owned,"top_differential":top_diff,"captain_popularity":cap_pop,"highest_scoring":highest},"charts":{"performance":{"labels":[f"GW {e}" for e in last6],"series":performance},"positions":{"labels":[f"GW {e}" for e in last6],"series":positions}},"gameweek_winners":winners}
    OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(payload,indent=2,ensure_ascii=False),encoding="utf-8");print(f"Wrote {OUT} with {mc} managers for GW {gw}")
if __name__=="__main__":main()
