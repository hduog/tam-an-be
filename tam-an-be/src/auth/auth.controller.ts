import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { AuthMeResponseDto } from './dto/auth-me-response.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RefreshResponseDto } from './dto/refresh-response.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './interfaces/jwt-payload.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Đăng ký tài khoản bằng email/password' })
  @ApiResponse({ status: 201, description: 'Tạo tài khoản thành công' })
  @ApiResponse({ status: 409, description: 'Email đã được sử dụng' })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
    return this.authService.register(dto);
  }

  @ApiOperation({
    summary: 'Đăng nhập bằng email/password',
    description: 'Giới hạn 5 lần thử / IP / 60s để chống brute-force.',
  })
  @ApiResponse({ status: 200, description: 'Đăng nhập thành công' })
  @ApiResponse({ status: 401, description: 'Sai email hoặc mật khẩu' })
  @ApiResponse({ status: 429, description: 'Vượt quá số lần thử cho phép' })
  // Chống brute-force: tối đa 5 lần thử / IP / 60s (Issue #03 AC).
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body() dto: LoginDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<LoginResponseDto> {
    return this.authService.login(dto, userAgent ?? null);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Lấy thông tin tài khoản của phiên hiện tại' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 401, description: 'Token thiếu/sai/hết hạn' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  me(@CurrentUser() user: AuthenticatedUser): Promise<AuthMeResponseDto> {
    return this.authService.me(user.id);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Đăng xuất phiên hiện tại',
    description:
      'Thu hồi đúng refresh token của phiên hiện tại, không ảnh hưởng thiết bị khác. Idempotent — luôn trả 200 kể cả khi token đã bị thu hồi.',
  })
  @ApiResponse({ status: 200, description: 'Đăng xuất thành công' })
  @ApiResponse({ status: 401, description: 'Thiếu/sai access token' })
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: LogoutDto,
  ): Promise<{ message: string }> {
    return this.authService.logout(user.id, dto);
  }

  @ApiOperation({
    summary: 'Cấp lại cặp access/refresh token (rotate)',
    description:
      'Refresh token cũ bị thu hồi ngay khi cấp cặp mới thành công. Dùng lại refresh token đã bị thu hồi (dấu hiệu bị đánh cắp) sẽ thu hồi toàn bộ token của user đó.',
  })
  @ApiResponse({ status: 200, description: 'Cấp lại token thành công' })
  @ApiResponse({
    status: 401,
    description: 'Refresh token không hợp lệ/hết hạn/đã bị thu hồi',
  })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body() dto: RefreshDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<RefreshResponseDto> {
    return this.authService.refresh(dto, userAgent ?? null);
  }

  @ApiOperation({
    summary: 'Đăng nhập bằng Google/Apple',
    description:
      'Verify idToken với provider, tự tạo tài khoản nếu chưa tồn tại. Nếu email đã đăng ký local hoặc social provider khác, từ chối (409) thay vì tự liên kết ngầm định.',
  })
  @ApiResponse({ status: 200, description: 'Đăng nhập/đăng ký thành công' })
  @ApiResponse({ status: 401, description: 'idToken không hợp lệ/hết hạn' })
  @ApiResponse({
    status: 409,
    description: 'Email đã được dùng bởi local account hoặc provider khác',
  })
  @Post('social')
  @HttpCode(HttpStatus.OK)
  social(
    @Body() dto: SocialLoginDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<LoginResponseDto> {
    return this.authService.socialLogin(dto, userAgent ?? null);
  }

  @ApiOperation({
    summary: 'Xác thực email bằng token gửi trong link email',
  })
  @ApiResponse({ status: 200, description: 'Xác thực thành công' })
  @ApiResponse({
    status: 401,
    description: 'Token không hợp lệ/hết hạn',
  })
  @ApiResponse({ status: 409, description: 'Email đã được xác thực trước đó' })
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<{ message: string }> {
    return this.authService.verifyEmail(dto);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Gửi lại email xác thực',
    description: 'Gửi lại cho chính email của tài khoản đang đăng nhập.',
  })
  @ApiResponse({ status: 200, description: 'Đã gửi lại email' })
  @ApiResponse({ status: 401, description: 'Thiếu/sai access token' })
  @ApiResponse({ status: 409, description: 'Email đã được xác thực trước đó' })
  @UseGuards(JwtAuthGuard)
  @Post('resend-verification-email')
  @HttpCode(HttpStatus.OK)
  resendVerificationEmail(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ message: string }> {
    return this.authService.resendVerificationEmail(user.id);
  }
}
