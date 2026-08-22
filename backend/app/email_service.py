import html
import os

import httpx


APP_URL = os.getenv("APP_URL", "http://127.0.0.1:5173").rstrip("/")
EMAIL_FROM = os.getenv("EMAIL_FROM", "Mushroom Forage Map <accounts@worldmushroomforaging.org>")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")


def send_account_email(to: str, subject: str, heading: str, message: str, action: str, path: str) -> bool:
    if not RESEND_API_KEY:
        return False
    url = f"{APP_URL}{path}"
    markup = f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17211b">
      <h1 style="font-size:24px">{html.escape(heading)}</h1>
      <p style="line-height:1.6">{html.escape(message)}</p>
      <p><a href="{html.escape(url)}" style="background:#176b45;color:#fff;padding:12px 18px;text-decoration:none;border-radius:6px">{html.escape(action)}</a></p>
      <p style="font-size:13px;color:#5e6a62">This link expires soon. If you did not request it, you can ignore this email.</p>
    </div>
    """
    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={"from": EMAIL_FROM, "to": [to], "subject": subject, "html": markup},
            timeout=10,
        )
        response.raise_for_status()
        return True
    except httpx.HTTPError:
        return False


def send_digest_email(to: str, username: str, items: list[dict]) -> bool:
    if not RESEND_API_KEY or not items:
        return False
    rows = "".join(
        f"""
        <tr>
          <td style="padding:14px 0;border-top:1px solid #5f5648">
            <a href="{html.escape(APP_URL + item['path'])}" style="color:#dfb887;font-family:Georgia,serif;font-size:18px;text-decoration:none">{html.escape(item['label'])}</a>
            <div style="color:#bbb0a1;font-size:14px;line-height:1.5;margin-top:4px">{html.escape(item['summary'])}</div>
          </td>
        </tr>
        """
        for item in items
    )
    markup = f"""
    <div style="background:#121211;color:#eee7dc;font-family:Arial,sans-serif;margin:auto;max-width:620px;padding:30px">
      <div style="color:#d65b35;font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase">Field bulletin</div>
      <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:400;margin:12px 0 8px">Fresh observations for {html.escape(username)}</h1>
      <p style="color:#bbb0a1;line-height:1.6;margin:0 0 22px">Here is the past week's public activity for the species and regions you follow.</p>
      <table role="presentation" style="border-collapse:collapse;width:100%">{rows}</table>
      <p style="margin:24px 0 0"><a href="{html.escape(APP_URL + '/account?tab=alerts')}" style="background:#d65b35;color:#fff;padding:11px 16px;text-decoration:none">Manage alerts</a></p>
      <p style="color:#81786d;font-size:12px;line-height:1.5;margin-top:24px">Observations are evidence of recent activity, not a guarantee of current conditions or safe identification.</p>
    </div>
    """
    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={
                "from": EMAIL_FROM,
                "to": [to],
                "subject": "Your weekly mushroom field bulletin",
                "html": markup,
            },
            timeout=10,
        )
        response.raise_for_status()
        return True
    except httpx.HTTPError:
        return False
