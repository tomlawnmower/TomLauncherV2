use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use image::{ImageBuffer, Rgba};
use std::io::Cursor;
use std::path::Path;

pub fn extract_icon_as_base64(file_path: &str) -> Result<String, String> {
    if file_path.trim().is_empty() || !Path::new(file_path).exists() {
        return Ok(create_fallback_icon(file_path));
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(base64_data) = extract_windows_icon(file_path) {
            return Ok(base64_data);
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(base64_data) = extract_linux_icon(file_path) {
            return Ok(base64_data);
        }
    }

    // Default fallback icon (folder or file SVG placeholder encoded to Base64)
    Ok(create_fallback_icon(file_path))
}

pub fn process_icon_pixels(
    width: u32,
    height: u32,
    color_buffer: &[u8],
    mask_buffer: Option<&[u8]>,
) -> ImageBuffer<Rgba<u8>, Vec<u8>> {
    let has_alpha = color_buffer.chunks_exact(4).any(|p| p[3] > 0);

    let mut img: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::new(width, height);
    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;
            let b = color_buffer[idx];
            let g = color_buffer[idx + 1];
            let r = color_buffer[idx + 2];
            let a = if has_alpha {
                color_buffer[idx + 3]
            } else if let Some(mask) = mask_buffer {
                if mask[idx] > 0 || mask[idx + 1] > 0 || mask[idx + 2] > 0 {
                    0
                } else {
                    255
                }
            } else {
                255
            };

            img.put_pixel(x, y, Rgba([r, g, b, a]));
        }
    }
    img
}

#[cfg(target_os = "windows")]
fn extract_windows_icon(file_path: &str) -> Result<String, String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::HMODULE;
    use windows_sys::Win32::Graphics::Gdi::{
        CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, SelectObject, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
    };
    use windows_sys::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryA};
    use windows_sys::Win32::UI::Shell::{SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON};
    use windows_sys::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, ICONINFO};

    type FnSHGetFileInfoW = unsafe extern "system" fn(
        psz_path: *const u16,
        dw_file_attributes: u32,
        psfi: *mut SHFILEINFOW,
        cb_file_info: u32,
        u_flags: u32,
    ) -> usize;

    let path_wide: Vec<u16> = OsStr::new(file_path).encode_wide().chain(std::iter::once(0)).collect();

    unsafe {
        let shell32: HMODULE = LoadLibraryA(b"shell32.dll\0".as_ptr());
        if shell32.is_null() {
            return Err("Failed to load shell32.dll".to_string());
        }

        let proc = GetProcAddress(shell32, b"SHGetFileInfoW\0".as_ptr());
        if proc.is_none() {
            return Err("Failed to find SHGetFileInfoW".to_string());
        }

        let sh_get_file_info: FnSHGetFileInfoW = std::mem::transmute(proc.unwrap());

        let mut shfi: SHFILEINFOW = std::mem::zeroed();
        let result = sh_get_file_info(
            path_wide.as_ptr(),
            0,
            &mut shfi,
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_LARGEICON,
        );

        if result == 0 || shfi.hIcon.is_null() {
            return Err("SHGetFileInfoW failed".to_string());
        }

        let hicon = shfi.hIcon;
        let mut icon_info: ICONINFO = std::mem::zeroed();
        if GetIconInfo(hicon, &mut icon_info) == 0 {
            DestroyIcon(hicon);
            return Err("GetIconInfo failed".to_string());
        }

        let hbm_color = if !icon_info.hbmColor.is_null() {
            icon_info.hbmColor
        } else {
            icon_info.hbmMask
        };

        let width = 32;
        let height = 32;
        let mut bmi: BITMAPINFOHEADER = std::mem::zeroed();
        bmi.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bmi.biWidth = width;
        bmi.biHeight = -height; // Top-down bitmap
        bmi.biPlanes = 1;
        bmi.biBitCount = 32;
        bmi.biCompression = BI_RGB;

        let hdc = CreateCompatibleDC(std::ptr::null_mut());
        let mut buffer: Vec<u8> = vec![0; (width * height * 4) as usize];

        let old_obj = SelectObject(hdc, hbm_color as *mut _);
        GetDIBits(
            hdc,
            hbm_color,
            0,
            height as u32,
            buffer.as_mut_ptr() as *mut _,
            &mut bmi as *mut _ as *mut _,
            DIB_RGB_COLORS,
        );
        SelectObject(hdc, old_obj);

        let has_alpha = buffer.chunks_exact(4).any(|p| p[3] > 0);
        let mut mask_buffer: Vec<u8> = vec![0; (width * height * 4) as usize];
        let mut has_mask_data = false;

        if !has_alpha && !icon_info.hbmMask.is_null() {
            let old_mask_obj = SelectObject(hdc, icon_info.hbmMask as *mut _);
            let mask_res = GetDIBits(
                hdc,
                icon_info.hbmMask,
                0,
                height as u32,
                mask_buffer.as_mut_ptr() as *mut _,
                &mut bmi as *mut _ as *mut _,
                DIB_RGB_COLORS,
            );
            SelectObject(hdc, old_mask_obj);
            if mask_res > 0 {
                has_mask_data = true;
            }
        }

        DeleteDC(hdc);
        if !icon_info.hbmColor.is_null() { DeleteObject(icon_info.hbmColor as *mut _); }
        if !icon_info.hbmMask.is_null() { DeleteObject(icon_info.hbmMask as *mut _); }
        DestroyIcon(hicon);

        let img = process_icon_pixels(
            width as u32,
            height as u32,
            &buffer,
            if has_mask_data { Some(&mask_buffer) } else { None },
        );

        let mut png_bytes: Vec<u8> = Vec::new();
        let mut cursor = Cursor::new(&mut png_bytes);
        img.write_to(&mut cursor, image::ImageFormat::Png)
            .map_err(|e| e.to_string())?;

        let base64_str = BASE64.encode(&png_bytes);
        Ok(format!("data:image/png;base64,{}", base64_str))
    }
}

#[cfg(not(target_os = "windows"))]
fn extract_linux_icon(_file_path: &str) -> Result<String, String> {
    Err("Not implemented for native linux icon lookup yet".to_string())
}

fn create_fallback_icon(file_path: &str) -> String {
    let is_dir = Path::new(file_path).is_dir();
    let svg = if is_dir {
        r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3b82f6" width="32" height="32"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>"##
    } else {
        r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#10b981" width="32" height="32"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>"##
    };

    let base64_svg = BASE64.encode(svg.as_bytes());
    format!("data:image/svg+xml;base64,{}", base64_svg)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_icon_pixels_preserves_alpha_transparency() {
        // Create 2x1 BGRA buffer: pixel 1 is transparent, pixel 2 is opaque red
        let color_buffer: Vec<u8> = vec![
            0, 0, 0, 0,      // pixel 0: BGRA (0, 0, 0, 0) -> transparent
            0, 0, 255, 255,  // pixel 1: BGRA (0, 0, 255, 255) -> opaque red
        ];

        let img = process_icon_pixels(2, 1, &color_buffer, None);
        assert_eq!(img.get_pixel(0, 0), &Rgba([0, 0, 0, 0]), "Transparent pixel alpha must be preserved as 0");
        assert_eq!(img.get_pixel(1, 0), &Rgba([255, 0, 0, 255]), "Opaque red pixel alpha must be preserved as 255");
    }

    #[test]
    fn test_process_icon_pixels_uses_mask_for_legacy_24bit_icon() {
        // Create 2x1 BGRA buffer with alpha = 0 (24-bit legacy GDI icon)
        let color_buffer: Vec<u8> = vec![
            0, 0, 0, 0,     // pixel 0
            255, 0, 0, 0,   // pixel 1
        ];

        // Mask buffer: pixel 0 has mask bit set (white = transparent), pixel 1 has mask bit 0 (black = opaque)
        let mask_buffer: Vec<u8> = vec![
            255, 255, 255, 0, // pixel 0: transparent
            0, 0, 0, 0,       // pixel 1: opaque
        ];

        let img = process_icon_pixels(2, 1, &color_buffer, Some(&mask_buffer));
        assert_eq!(img.get_pixel(0, 0), &Rgba([0, 0, 0, 0]), "Masked pixel must be transparent (alpha 0)");
        assert_eq!(img.get_pixel(1, 0), &Rgba([0, 0, 255, 255]), "Unmasked pixel must be opaque (alpha 255)");
    }
}
