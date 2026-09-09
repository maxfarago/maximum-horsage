const CM_PER_HAND = 10.16;

function json(data, status){
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

async function readKing(env){
  if (!env.KING) return null;
  return env.KING.get("king", "json");
}

export async function onRequestGet({ env }){
  return json({ king: await readKing(env) });
}

export async function onRequestPost({ request, env }){
  if (!env.KING) return json({ error: "no king" }, 500);
  var body;
  try { body = await request.json(); }
  catch (e){ return json({ error: "bad json" }, 400); }

  var prev = await readKing(env);
  if (body && (body.dirty || body.seed === "dev")){
    return json({ took: false, king: prev });
  }

  var radius = Number(body && body.radius);
  var hp = Number(body && body.hp);
  var collected = Number(body && body.collected);
  var seed = String((body && body.seed) || "").slice(0, 40);
  if (!Number.isFinite(radius) || radius < 0.3 || radius > 80){
    return json({ error: "bad radius" }, 400);
  }
  if (!Number.isFinite(hp) || hp < 1 || hp > 1e6){
    return json({ error: "bad hp" }, 400);
  }
  if (!Number.isFinite(collected) || collected < 0 || collected > 20000){
    return json({ error: "bad collected" }, 400);
  }

  var hh = radius * 200 / CM_PER_HAND;
  var next = { hh: hh, radius: radius, hp: hp, collected: collected, seed: seed, at: Date.now() };
  if (prev && Number(prev.hh) >= hh) return json({ took: false, king: prev });
  await env.KING.put("king", JSON.stringify(next));
  return json({ took: true, king: next });
}
