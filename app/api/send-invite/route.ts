import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const EMAIL_FROM = "AIAURA Group <hello@prodicta.co.uk>";

type Attendee = { name?: string; email?: string };

type InvitePayload = {
  attendees?: Attendee[];
  staffName?: string;
  product?: string;
  demoDate?: string;
  demoTime?: string;
  meetUrl?: string;
};

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(opts: {
  attendeeName: string;
  staffName: string;
  product: string;
  demoDate: string;
  demoTime: string;
  meetUrl: string;
}): string {
  const { attendeeName, staffName, product, demoDate, demoTime, meetUrl } = opts;
  const productLine = product ? `<div><strong>Product:</strong> ${escapeHtml(product)}</div>` : "";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Outfit',system-ui,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:600px;margin:40px auto;">
    <div style="background:#0c1e3c;padding:24px 32px;border-radius:14px 14px 0 0;">
      <div style="font-size:22px;font-weight:800;letter-spacing:-0.3px;color:#ffffff;">AIAURA <span style="color:#3bbfad;">Group</span></div>
      <div style="color:rgba(255,255,255,0.55);font-size:11px;margin-top:4px;letter-spacing:0.07em;text-transform:uppercase;">Demo confirmed</div>
    </div>
    <div style="background:#ffffff;padding:30px 32px;border:1px solid #e4e9f0;border-top:none;">
      <p style="font-size:15px;margin:0 0 14px;">Hi ${escapeHtml(attendeeName)},</p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 18px;">Looking forward to speaking with you about how we can help.</p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 12px;"><strong>Here are your demo details:</strong></p>
      <div style="background:#f7f9fb;border-left:3px solid #3bbfad;padding:14px 18px;border-radius:6px;font-size:14px;line-height:1.8;margin-bottom:18px;">
        <div><strong>Date:</strong> ${escapeHtml(demoDate)}</div>
        <div><strong>Time:</strong> ${escapeHtml(demoTime)}</div>
        ${productLine}
        <div style="margin-top:8px;"><strong>Join here:</strong> <a href="${escapeHtml(meetUrl)}" style="color:#3bbfad;">${escapeHtml(meetUrl)}</a></div>
      </div>
      <div style="text-align:center;margin:22px 0;">
        <a href="${escapeHtml(meetUrl)}" style="display:inline-block;background:#3bbfad;color:#ffffff;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;">Join Demo Room</a>
      </div>
      <p style="font-size:14px;line-height:1.6;margin:18px 0 0;">If you have any questions before we speak, feel free to get in touch.</p>
      <p style="font-size:14px;line-height:1.6;margin:14px 0 0;">Speak soon,<br/><strong>${escapeHtml(staffName)}</strong><br/>AIAURA Group</p>
    </div>
    <div style="background:#f7f9fb;padding:14px 32px;border-radius:0 0 14px 14px;border:1px solid #e4e9f0;border-top:none;text-align:center;">
      <p style="font-size:11.5px;color:#94a1b3;margin:0;">AIAURA Group &middot; Demo confirmation</p>
    </div>
  </div>
</body>
</html>`;
}

function buildText(opts: {
  attendeeName: string;
  staffName: string;
  product: string;
  demoDate: string;
  demoTime: string;
  meetUrl: string;
}): string {
  const { attendeeName, staffName, product, demoDate, demoTime, meetUrl } = opts;
  const productLine = product ? `Product: ${product}\n` : "";
  return `Hi ${attendeeName},

Looking forward to speaking with you about how we can help.

Here are your demo details:

Date: ${demoDate}
Time: ${demoTime}
${productLine}Join here: ${meetUrl}

If you have any questions before we speak, feel free to get in touch.

Speak soon,
${staffName}
AIAURA Group`;
}

export async function OPTIONS() {
  return NextResponse.json(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is not configured" },
        { status: 500, headers: corsHeaders }
      );
    }

    const body = (await request.json()) as InvitePayload;
    const { attendees, staffName, product, demoDate, demoTime, meetUrl } = body || {};

    if (!Array.isArray(attendees) || attendees.length === 0) {
      return NextResponse.json(
        { error: "attendees must be a non-empty array of {name, email}" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!staffName || !demoDate || !demoTime || !meetUrl) {
      return NextResponse.json(
        { error: "staffName, demoDate, demoTime and meetUrl are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const recipients = attendees.filter(
      (a): a is Required<Pick<Attendee, "email">> & Attendee =>
        !!a && typeof a.email === "string" && a.email.trim().length > 0
    );
    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "No attendees with a valid email address" },
        { status: 400, headers: corsHeaders }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const subject = `Your demo is confirmed - ${demoDate} at ${demoTime}`;

    const results = await Promise.all(
      recipients.map(async (a) => {
        const attendeeName = (a.name && a.name.trim()) || "there";
        const html = buildHtml({
          attendeeName,
          staffName,
          product: product || "",
          demoDate,
          demoTime,
          meetUrl,
        });
        const text = buildText({
          attendeeName,
          staffName,
          product: product || "",
          demoDate,
          demoTime,
          meetUrl,
        });
        try {
          const sendRes = await resend.emails.send({
            from: EMAIL_FROM,
            to: [a.email!.trim()],
            subject,
            html,
            text,
          });
          if (sendRes.error) {
            return { email: a.email, ok: false, error: sendRes.error.message };
          }
          return { email: a.email, ok: true, id: sendRes.data?.id };
        } catch (err) {
          const message = err instanceof Error ? err.message : "send failed";
          return { email: a.email, ok: false, error: message };
        }
      })
    );

    const sent = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);

    return NextResponse.json(
      {
        success: failed.length === 0,
        sent: sent.length,
        failed: failed.length,
        results,
      },
      { status: failed.length === 0 ? 200 : 207, headers: corsHeaders }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}
