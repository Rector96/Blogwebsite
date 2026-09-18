export default async () => {
  const publisherId = Netlify.env.get("ADSENSE_PUBLISHER_ID") || "";
  if (!/^pub-[0-9]{16}$/.test(publisherId)) {
    return new Response("RWDNEWS ads.txt is not configured yet.\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return new Response("google.com, " + publisherId + ", DIRECT, f08c47fec0942fa0\n", {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
};
