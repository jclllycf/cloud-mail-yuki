import {getExtName} from "@/utils/file-utils.js";

export function getIconByName(filename) {
    const extName = getExtName(filename)
    if (['zip', 'rar', '7z', 'tar', 'tgz'].includes(extName)) return {
        name: 'file-archive',
        width: '24px',
        height: '24px',
        color: 'var(--letter-muted)',
    };
    if (['png', 'jpg', 'jpeg','gif','webp','jfif'].includes(extName)) return {
        name: 'file-image',
        width: '24px',
        height: '24px',
        color: ''
    };
    if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv'].includes(extName)) return {
        name: 'file-video',
        width: '24px',
        height: '24px',
        color: 'var(--letter-muted)'
    };
    if (['txt','md','ini','conf'].includes(extName)) return {
        name: 'file-text',
        width: '24px',
        height: '24px',
        color: ''
    };
    if (['doc', 'docx'].includes(extName)) return {
        name: 'file-word',
        width: '23px',
        height: '23px',
        color: ''
    };
    if (['xls', 'csv', 'xlsx'].includes(extName)) return {
        name: 'file-sheet',
        width: '23px',
        height: '23px',
        color: ''
    };
    if (['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'].includes(extName)) return {
        name: 'file-audio',
        width: '24px',
        height: '24px',
        color: 'var(--letter-muted)'
    };
    if (['ppt', 'pptx', 'pps', 'potx', 'pot'].includes(extName)) return {
        name: 'file-slides',
        width: '24px',
        height: '24px',
        color: ''
    };
    if (extName === 'pdf') return {
        name: 'file-pdf',
        width: '24px',
        height: '24px',
        color: ''
    };
    return {
        name: "file",
        width: '24px',
        height: '24px',
        color: 'var(--letter-muted)'
    };

}
