import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './services/auth.service';
import { SetupGuard } from './guards/setup.guard';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { PasswordResetDto } from './dto/password-reset.dto';
import { VerifyUserTokenDto } from './dto/verify-user-token.dto';
import { FastifyReply } from 'fastify';
import { validateSsoEnforcement } from './auth.util';
import { TwoFAVerifyDto } from '../../ee/2fa/dto/2fa.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly environmentService: EnvironmentService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Res({ passthrough: true }) res: FastifyReply,
    @Body() loginDto: LoginDto,
  ) {
    const { token, workspace } = await this.authService.login(
      loginDto,
      this.environmentService.getWorkspaceId(),
    );

    this.setAuthCookie(res, token);
    return workspace;
  }

  @HttpCode(HttpStatus.OK)
  @Post('register')
  async register(
    @Res({ passthrough: true }) res: FastifyReply,
    @Body() createUserDto: CreateUserDto,
  ) {
    const { token, workspace } = await this.authService.register(
      createUserDto,
      this.environmentService.getWorkspaceId(),
    );

    this.setAuthCookie(res, token);
    return workspace;
  }

  @UseGuards(SetupGuard)
  @HttpCode(HttpStatus.OK)
  @Post('setup')
  async setupWorkspace(
    @Res({ passthrough: true }) res: FastifyReply,
    @Body() createAdminUserDto: CreateAdminUserDto,
  ) {
    const { workspace, authToken } =
      await this.authService.setup(createAdminUserDto);

    this.setAuthCookie(res, authToken);
    return workspace;
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.authService.changePassword(dto, user.id, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.authService.forgotPassword(dto, workspace);
  }

  @HttpCode(HttpStatus.OK)
  @Post('password-reset')
  async passwordReset(
    @Res({ passthrough: true }) res: FastifyReply,
    @Body() dto: PasswordResetDto,
  ) {
    const { token, workspace } = await this.authService.passwordReset(
      dto,
      this.environmentService.getWorkspaceId(),
    );

    this.setAuthCookie(res, token);
    return workspace;
  }

  @HttpCode(HttpStatus.OK)
  @Post('verify-user-token')
  async verifyUserToken(
    @Body() dto: VerifyUserTokenDto,
  ) {
    return this.authService.verifyUserToken(
      dto,
      this.environmentService.getWorkspaceId(),
    );
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('collab-token')
  async collabToken(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.authService.getCollabToken(user.id, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login-with-2fa')
  async loginWith2FA(
    @Res({ passthrough: true }) res: FastifyReply,
    @Body() dto: { userId: string; twoFAToken: string },
  ) {
    const { token, workspace } = await this.authService.loginWith2FA(
      dto.userId,
      this.environmentService.getWorkspaceId(),
      dto.twoFAToken,
    );

    this.setAuthCookie(res, token);
    return workspace;
  }

  setAuthCookie(res: FastifyReply, token: string) {
    res.setCookie('authToken', token, {
      httpOnly: true,
      path: '/',
      expires: this.environmentService.getCookieExpiresIn(),
      secure: this.environmentService.isHttps(),
    });
  }
}
